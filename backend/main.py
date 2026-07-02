import os
import json
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import (
    test_connection,
    save_ticket,
    get_ticket_by_id,
    get_user_by_email,
    create_user,
    create_tenant_api_key,
    get_active_api_key_for_tenant,
    slugify_tenant_id,
    tenant_workspace_exists,
    tickets_collection,
    sops_collection,
    save_blog_draft,
    get_blog_draft_by_id,
    update_blog_draft as update_blog_draft_record,
    list_blog_drafts,
    get_sop_by_tag,
)
from openai import OpenAI
from models import (
    TicketRequest,
    TicketAnalysis,
    TicketUpdateRequest,
    IngestAckResponse,
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    SOPCreate,
    SOPResponse,
)
from auth import (
    get_current_user,
    require_admin_role,
    get_tenant_from_api_key,
    create_access_token,
    hash_password,
)
from services import generate_blog_task
from typing import List, Optional
from bson import ObjectId
from datetime import datetime, timezone
from confidence_score import (
    calculate_confidence,
    derive_retrieval_signals,
    extract_average_logprob,
)

load_dotenv()

app = FastAPI(title="SupportInsightAPI", description="API for Support Insight", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "SupportInsight API is running!"}

@app.get("/health")
async def health_check():
    db_ok = await test_connection()
    return {"status": "healthy", "database": "connected" if db_ok else "disconnected"}

deepseek_client = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY"),
    base_url=os.environ.get("DEEPSEEK_BASE_URL"),
)

def _safe_bool(v):
    return bool(v) if isinstance(v, bool) else str(v).lower() in ("1", "true", "yes")


def _safe_float(v):
    try:
        f = float(v)
        return max(0.0, min(1.0, f))
    except Exception:
        return 0.0


def _safe_str_list(v):
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v]
    if isinstance(v, str):
        try:
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return [str(x) for x in parsed]
        except Exception:
            pass
        return [s.strip() for s in v.split(",") if s.strip()]
    return []


async def process_ticket_ingest(message: str, tenant_id: str) -> str:
    """
    Run the Deepseek compliance/confidence pipeline and persist a TicketDocument.
    Returns the new ticket id.
    """
    predicted_tag = predict_tag_from_text(message) or classify_message_category(message)

    sop_instructions = None
    if predicted_tag:
        sop_doc = await get_sop_by_tag(predicted_tag, tenant_id=tenant_id)
        if sop_doc:
            sop_instructions = sop_doc.get("content")

    system_prompt = """You are a customer support triage assistant for a SaaS company.
Analyze the customer message and output a JSON object with exactly these fields:
{
  "category": "bug" | "feature_request" | "refund" | "complaint" | "other",
  "priority": "high" | "medium" | "low",
  "draft_reply": "string containing a professional email reply",
  "reasoning": "brief explanation of why you chose this category and priority",
  "is_sop_compliant": true | false,
  "confidence_score": 0.0,
  "sop_rules_followed": ["step 1 text", "step 2 text"]
}
Output ONLY valid JSON. No other text."""

    if sop_instructions:
        system_prompt += (
            "\n\nCOMPANY SOP INSTRUCTIONS (apply these rules exactly):\n"
            + sop_instructions
            + "\n\nAfter producing the draft reply, CHECK whether the reply fully follows the SOP text above. "
            "Set `is_sop_compliant` to true only if the reply *explicitly follows* the SOP rules; otherwise false. "
            "List the concrete SOP steps you followed in `sop_rules_followed`. Provide a numeric `confidence_score` "
            "between 0.0 (no confidence) and 1.0 (very confident) that the classification and compliance check are correct."
        )

    response = deepseek_client.chat.completions.create(
        model="deepseek-chat",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
        logprobs=True,
        top_logprobs=1,
    )

    content = response.choices[0].message.content
    result = json.loads(content)

    category = result.get("category", "other")
    priority = result.get("priority", "medium")
    draft_reply = result.get(
        "draft_reply", "Thank you for your message. We will get back to you shortly."
    )
    reasoning = result.get("reasoning")

    is_sop_compliant = _safe_bool(result.get("is_sop_compliant", False))

    sop_rules_followed = _safe_str_list(result.get("sop_rules_followed", []))

    avg_logprobs = extract_average_logprob(response)
    retrieval_score, evidence_count = derive_retrieval_signals(message, sop_instructions)
    confidence_score = calculate_confidence(
        retrieval_score=retrieval_score,
        evidence_count=evidence_count,
        avg_logprobs=avg_logprobs,
        compliance_met=is_sop_compliant,
    )

    analysis = TicketAnalysis(
        category=category,
        priority=priority,
        draft_reply=draft_reply,
        reasoning=reasoning,
        is_sop_compliant=is_sop_compliant,
        confidence_score=confidence_score,
        sop_rules_followed=sop_rules_followed,
    )

    if not analysis.is_sop_compliant:
        status_val = "Escalated"
        internal_notes = (
            "Auto-escalated: AI indicated the reply did NOT follow company SOPs. "
            "Manual review required before sending."
        )
    else:
        status_val = "Auto-Drafted"
        internal_notes = "Auto-drafted: AI indicated the reply follows company SOPs."

    return await save_ticket(
        tenant_id=tenant_id,
        original_message=message,
        category=analysis.category,
        priority=analysis.priority,
        draft_reply=analysis.draft_reply,
        reasoning=analysis.reasoning,
        confidence_score=analysis.confidence_score,
        is_sop_compliant=analysis.is_sop_compliant,
        sop_rules_followed=analysis.sop_rules_followed,
        status=status_val,
        internal_notes=internal_notes,
    )


async def save_failed_ingest_ticket(message: str, tenant_id: str, reason: str) -> str:
    return await save_ticket(
        tenant_id=tenant_id,
        original_message=message,
        category="other",
        priority="medium",
        draft_reply="Thank you for your message. Our team will review this and respond shortly.",
        reasoning=reason,
        confidence_score=0.0,
        is_sop_compliant=False,
        sop_rules_followed=[],
        status="Pending (AI Failed)",
        internal_notes=reason,
    )


@app.post("/api/tickets/ingest", response_model=IngestAckResponse, status_code=status.HTTP_200_OK)
async def ingest_ticket(
    request: TicketRequest,
    tenant_id: str = Depends(get_tenant_from_api_key),
):
    """
    Public-facing gateway for inbound customer email webhooks.
    Authenticated via X-API-Key; persists the ticket and returns a clean ack.
    """
    try:
        await process_ticket_ingest(request.message, tenant_id)
    except json.JSONDecodeError:
        await save_failed_ingest_ticket(
            request.message,
            tenant_id,
            "AI response was not valid JSON",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error ingesting ticket: {e}")

    return IngestAckResponse()


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    """Issue a JWT for dashboard agents/admins."""
    user = await get_user_by_email(credentials.email.lower().strip())
    if user:
        if user.get("password_hash") != hash_password(credentials.password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        token = create_access_token(
            user_id=str(user["_id"]),
            role=user.get("role", "agent"),
            tenant_id=user["tenant_id"],
        )
        ingest_api_key = await get_active_api_key_for_tenant(user["tenant_id"])
        return TokenResponse(access_token=token, ingest_api_key=ingest_api_key)

    dev_email = os.getenv("DEV_AGENT_EMAIL")
    dev_password = os.getenv("DEV_AGENT_PASSWORD")
    dev_tenant = os.getenv("INGEST_TENANT_ID", "default_tenant")
    if (
        dev_email
        and dev_password
        and credentials.email == dev_email
        and credentials.password == dev_password
    ):
        token = create_access_token(
            user_id="dev-agent",
            role=os.getenv("DEV_AGENT_ROLE", "admin"),
            tenant_id=dev_tenant,
        )
        ingest_api_key = await get_active_api_key_for_tenant(dev_tenant)
        return TokenResponse(access_token=token, ingest_api_key=ingest_api_key)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


@app.post("/api/auth/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """Create a new corporate workspace and its first admin account."""
    email = body.email.lower().strip()
    if await get_user_by_email(email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")

    tenant_id = slugify_tenant_id(body.company_name)
    if await tenant_workspace_exists(tenant_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workspace name already taken. Contact your company admin for access.",
        )

    user_id = await create_user(
        email=email,
        password_hash=hash_password(body.password),
        tenant_id=tenant_id,
        role="admin",
    )
    ingest_api_key = await create_tenant_api_key(tenant_id)

    token = create_access_token(user_id=user_id, role="admin", tenant_id=tenant_id)
    return RegisterResponse(
        access_token=token,
        tenant_id=tenant_id,
        ingest_api_key=ingest_api_key,
    )


@app.get("/history", response_model=List[dict])
async def get_history(
    limit: int = 50,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Retrieve previously analyzed tickets for the authenticated tenant."""
    return await _fetch_tickets(
        tenant_id=current_user["tenant_id"],
        limit=limit,
        category=category,
        priority=priority,
        search=search,
    )

async def _fetch_tickets(
    tenant_id: str,
    limit: int = 50,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
):
    query: dict = {"tenant_id": tenant_id}
    if category:
        query["category"] = category
    if priority:
        query["priority"] = priority
    if search:
        query["original_message"] = {"$regex": search, "$options": "i"}
    cursor = tickets_collection.find(query).sort("created_at", -1).limit(limit)
    tickets = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        tickets.append(doc)
    return tickets

@app.get("/api/tickets", response_model=List[dict])
async def get_all_tickets(
    limit: int = 50,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Only authenticated users can load their tenant ticket queue."""
    return await _fetch_tickets(
        tenant_id=current_user["tenant_id"],
        limit=limit,
        category=category,
        priority=priority,
        search=search,
    )

@app.patch("/api/tickets/{ticket_id}")
async def update_ticket_status(
    ticket_id: str,
    update_payload: TicketUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Only authenticated agents can mutate tickets in their tenant workspace."""
    if not ObjectId.is_valid(ticket_id):
        raise HTTPException(status_code=400, detail="Invalid ticket ID format")

    update_data = update_payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await tickets_collection.update_one(
        {"_id": ObjectId(ticket_id), "tenant_id": current_user["tenant_id"]},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")

    updated = await get_ticket_by_id(ticket_id, tenant_id=current_user["tenant_id"])
    return updated

@app.post("/api/sops", response_model=SOPResponse, status_code=status.HTTP_201_CREATED)
async def create_sop(sop: SOPCreate, current_user: dict = Depends(require_admin_role)):
    """
    Accepts a new SOP form payload and writes it to the tenant workspace.
    """
    sop_dict = sop.model_dump()
    now = datetime.now(timezone.utc)
    sop_dict["tenant_id"] = current_user["tenant_id"]
    sop_dict["created_at"] = now
    sop_dict["updated_at"] = now
    result = await sops_collection.insert_one(sop_dict)
    sop_dict["id"] = str(result.inserted_id)
    return sop_dict

@app.get("/api/sops", response_model=List[SOPResponse])
async def get_all_sops(
    tag: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Retrieve SOP rules for the authenticated tenant workspace."""
    query: dict = {"tenant_id": current_user["tenant_id"]}
    if tag:
        query["tags"] = tag
    cursor = sops_collection.find(query)
    sops = []
    for document in await cursor.to_list(length=100):
        document["id"] = str(document["_id"])
        del document["_id"]
        sops.append(document)
    return sops

@app.put("/api/sops/{sop_id}", response_model=SOPResponse)
async def update_sop(
    sop_id: str,
    sop: SOPCreate,
    current_user: dict = Depends(require_admin_role),
):
    """Update an existing SOP within the admin's tenant workspace."""
    if not ObjectId.is_valid(sop_id):
        raise HTTPException(status_code=400, detail="Invalid SOP ID format")
    sop_dict = sop.model_dump()
    sop_dict["updated_at"] = datetime.now(timezone.utc)
    sop_dict["tenant_id"] = current_user["tenant_id"]
    result = await sops_collection.update_one(
        {"_id": ObjectId(sop_id), "tenant_id": current_user["tenant_id"]},
        {"$set": sop_dict},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="SOP not found")

    updated_sop = await sops_collection.find_one(
        {"_id": ObjectId(sop_id), "tenant_id": current_user["tenant_id"]}
    )
    updated_sop["id"] = str(updated_sop["_id"])
    del updated_sop["_id"]
    return updated_sop

@app.delete("/api/sops/{sop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sop(sop_id: str, current_user: dict = Depends(require_admin_role)):
    """Delete an SOP within the admin's tenant workspace."""
    if not ObjectId.is_valid(sop_id):
        raise HTTPException(status_code=400, detail="Invalid SOP ID format")
    result = await sops_collection.delete_one(
        {"_id": ObjectId(sop_id), "tenant_id": current_user["tenant_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="SOP not found")

def predict_tag_from_text(text: str) -> Optional[str]:
    txt = (text or "").lower()
    if "refund" in txt or "money back" in txt:
        return "refund"
    if "bill" in txt or "invoice" in txt or "charge" in txt:
        return "billing"
    if "bug" in txt or "error" in txt or "not working" in txt:
        return "bug"
    if "feature" in txt or "would like" in txt or "enhancement" in txt:
        return "feature_request"
    if "complain" in txt or "unhappy" in txt or "angry" in txt:
        return "complaint"
    return None

def classify_message_category(message: str) -> Optional[str]:
    classifier_system = (
        "You are a concise classifier. Read the user's message and return EXACTLY a JSON object "
        'with one field: {"category": "<one-of: bug, feature_request, refund, complaint, other>"} '
        "No extra text, no explanation."
    )
    try:
        resp = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": classifier_system},
                {"role": "user", "content": message},
            ],
            max_tokens=60,
        )
        content = resp.choices[0].message.content
        parsed = json.loads(content)
        return parsed.get("category")
    except Exception:
        return None


async def _fetch_blog_drafts(tenant_id: str, limit: int = 50):
    return await list_blog_drafts(tenant_id=tenant_id, limit=limit)

@app.post("/api/blogs/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_blog(
    body: dict,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_tenant_from_api_key),
):
    topic = body.get("topic", "").strip()
    target_audience = body.get("target_audience")
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required")

    draft_id = await save_blog_draft(
        tenant_id=tenant_id,
        topic=topic,
        target_audience=target_audience,
        status="processing",
    )

    background_tasks.add_task(
        generate_blog_task,
        draft_id=draft_id,
        tenant_id=tenant_id,
        topic=topic,
        target_audience=target_audience,
    )

    return {"status": "accepted", "draft_id": draft_id}

@app.get("/api/blogs/drafts", response_model=List[dict])
async def get_blog_drafts(current_user: dict = Depends(get_current_user)):
    return await _fetch_blog_drafts(current_user["tenant_id"])

@app.patch("/api/blogs/drafts/{draft_id}")
async def update_blog_draft(
    draft_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(draft_id):
        raise HTTPException(status_code=400, detail="Invalid draft ID format")

    allowed_fields = {
        "title",
        "slug",
        "body_markdown",
        "excerpt",
        "seo_keywords",
        "target_audience",
        "status",
    }
    updates = {k: v for k, v in payload.items() if k in allowed_fields}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    updated = await update_blog_draft_record(
        draft_id=draft_id,
        tenant_id=current_user["tenant_id"],
        updates=updates,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Draft not found")
    return updated

@app.post("/api/blogs/{draft_id}/publish")
async def publish_blog(
    draft_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(draft_id):
        raise HTTPException(status_code=400, detail="Invalid draft ID format")

    draft = await get_blog_draft_by_id(draft_id, tenant_id=current_user["tenant_id"])
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    updates = {
        "title": payload.get("title", draft.get("title")),
        "slug": payload.get("slug", draft.get("slug")),
        "body_markdown": payload.get("body_markdown", draft.get("body_markdown")),
        "excerpt": payload.get("excerpt", draft.get("excerpt")),
        "seo_keywords": payload.get("seo_keywords", draft.get("seo_keywords", [])),
        "target_audience": payload.get("target_audience", draft.get("target_audience")),
        "status": "published",
        "published_at": datetime.now(timezone.utc),
    }

    updated = await update_blog_draft_record(
        draft_id=draft_id,
        tenant_id=current_user["tenant_id"],
        updates=updates,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Draft not found after update")

    return updated