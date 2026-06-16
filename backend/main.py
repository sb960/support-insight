import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import test_connection, save_ticket, get_all_tickets, get_ticket_by_id, tickets_collection, get_sop_by_tag
from openai import OpenAI
from models import TicketRequest, TicketAnalysis, SOPCreate, SOPResponse
from fastapi import HTTPException, APIRouter, status
from typing import List, Optional
from bson import ObjectId
from datetime import datetime, timezone
from confidence_score import calculate_mathematical_confidence

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

@app.post("/analyze", response_model=TicketAnalysis)
async def analyze_ticket(request: TicketRequest):
    """
    Two-pass analyze: classify -> fetch SOP -> instruct AI with SOP rules.
    Extended to request SOP compliance auditing fields:
      - is_sop_compliant: boolean
      - confidence_score: float [0.0, 1.0]
      - sop_rules_followed: list[string]
    """

    def safe_bool(v):
        return bool(v) if isinstance(v, bool) else str(v).lower() in ("1", "true", "yes")

    def safe_float(v):
        try:
            f = float(v)
            return max(0.0, min(1.0, f))
        except Exception:
            return 0.0

    def safe_str_list(v):
        if v is None:
            return []
        if isinstance(v, list):
            return [str(x) for x in v]
        # sometimes model might return a single string like "['a','b']" or "a, b"
        if isinstance(v, str):
            # try JSON parse first
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(x) for x in parsed]
            except Exception:
                pass
            # fallback: split comma-separated
            return [s.strip() for s in v.split(",") if s.strip()]
        return []

    try:
        # 1) Fast classification pass (heuristic or classifier)
        predicted_tag = predict_tag_from_text(request.message) or classify_message_category(request.message)

        # 2) Fetch SOP by tag (if any)
        sop_instructions = None
        if predicted_tag:
            sop_doc = await get_sop_by_tag(predicted_tag)
            if sop_doc:
                sop_instructions = sop_doc.get("content")

        # 3) Construct system prompt (base + SOP if found)
        system_prompt = """You are a customer support triage assistant for a SaaS company.
Analyze the customer message and output a JSON object with exactly these fields:
{
  "category": "bug" | "feature_request" | "refund" | "complaint" | "other",
  "priority": "high" | "medium" | "low",
  "draft_reply": "string containing a professional email reply",
  "reasoning": "brief explanation of why you chose this category and priority",
  "is_sop_compliant": true | false,
  "confidence_score": 0.0,   // float between 0.0 and 1.0
  "sop_rules_followed": ["step 1 text", "step 2 text"]  // array of strings, explicitly list which SOP steps were applied
}
Output ONLY valid JSON. No other text."""

        if sop_instructions:
            # Make SOP rules explicit and instruct the model to evaluate compliance.
            system_prompt += (
                "\n\nCOMPANY SOP INSTRUCTIONS (apply these rules exactly):\n"
                + sop_instructions
                + "\n\nAfter producing the draft reply, CHECK whether the reply fully follows the SOP text above. "
                "Set `is_sop_compliant` to true only if the reply *explicitly follows* the SOP rules; otherwise false. "
                "List the concrete SOP steps you followed in `sop_rules_followed`. Provide a numeric `confidence_score` "
                "between 0.0 (no confidence) and 1.0 (very confident) that the classification and compliance check are correct."
            )

        # 4) Final AI call to produce structured output (attempt to request logprobs)
        # Note: confirm your Deepseek client supports `logprobs` and `top_logprobs` kwargs.
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message},
            ],
            # Try to request token logprobs if the Deepseek client supports these flags.
            # If unsupported, these kwargs will be ignored or may raise — remove if needed.
            logprobs=True,
            top_logprobs=1,
        )

        # Parse the model output (expected JSON string)
        content = response.choices[0].message.content
        result = json.loads(content)

        # Defensive extraction with fallbacks (ensure variables are defined)
        category = result.get("category", "other")
        priority = result.get("priority", "medium")
        draft_reply = result.get(
            "draft_reply", "Thank you for your message. We will get back to you shortly."
        )
        reasoning = result.get("reasoning")

        # Try to extract raw logprobs from response (varies by provider)
        raw_logprobs = None
        try:
            ch0 = response.choices[0]
            raw_logprobs = getattr(ch0, "logprobs", None) or (
                getattr(ch0, "message", None) and getattr(ch0.message, "logprobs", None)
            ) or (ch0.get("logprobs") if isinstance(ch0, dict) else None)
        except Exception:
            raw_logprobs = None

        # Compute mathematical confidence (fallback to model-provided confidence if present)
        math_confidence = calculate_mathematical_confidence(raw_logprobs)
        # Prefer the mathematical score here
        final_confidence = math_confidence

        # Extract compliance fields defensively
        is_sop_compliant = safe_bool(result.get("is_sop_compliant", False))
        confidence_score = safe_float(result.get("confidence_score", final_confidence))
        # Use math_confidence if the parsed JSON didn't include a usable value
        if not confidence_score:
            confidence_score = final_confidence

        sop_rules_followed = safe_str_list(result.get("sop_rules_followed", []))

        # Optionally overwrite parsed result confidence with the computed value
        result["confidence_score"] = confidence_score

        analysis = TicketAnalysis(
            category=category,
            priority=priority,
            draft_reply=draft_reply,
            reasoning=reasoning,
            is_sop_compliant=is_sop_compliant,
            confidence_score=confidence_score,
            sop_rules_followed=sop_rules_followed,
        )

        # determine routing based on confidence_score
        confidence = getattr(analysis, "confidence_score", 0.0) or 0.0
        try:
            confidence = float(confidence)
        except Exception:
            confidence = 0.0

        # Decide status based on SOP compliance (hard safety override)
        if getattr(analysis, "is_sop_compliant", False) is False:
            status_val = "Escalated"
            internal_notes = (
                "Auto-escalated: AI indicated the reply did NOT follow company SOPs. "
                "Manual review required before sending."
            )
        else:
            status_val = "Auto-Drafted"
            internal_notes = "Auto-drafted: AI indicated the reply follows company SOPs."

        # Persist ticket with audit fields (database.save_ticket supports these params)
        ticket_id = await save_ticket(
            original_message=request.message,
            category=analysis.category,
            priority=analysis.priority,
            draft_reply=analysis.draft_reply,
            reasoning=analysis.reasoning,
            confidence_score=getattr(analysis, "confidence_score", 0.0),
            is_sop_compliant=bool(getattr(analysis, "is_sop_compliant", False)),
            sop_rules_followed=getattr(analysis, "sop_rules_followed", []),
            status=status_val,
            internal_notes=internal_notes,
        )

        return analysis

    except json.JSONDecodeError:
        # JSON parsing failed — return safe fallback with compliance=false, confidence=0.0
        return TicketAnalysis(
            category="other",
            priority="medium",
            draft_reply="Thank you for your message. Our team will review this and respond shortly.",
            reasoning="AI response was not valid JSON",
            is_sop_compliant=False,
            confidence_score=0.0,
            sop_rules_followed=[],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing ticket: {e}")

@app.get("/history", response_model=List[dict])
async def get_history(
    limit: int = 50,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None
    ):
    """Retrieve all previously analyzed tickets."""
    query = {}
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

@app.post("/api/sops", response_model=SOPResponse, status_code=status.HTTP_201_CREATED)
async def create_sop(sop: SOPCreate):
    """
    Accepts a new SOP form payload, validates its format via SOPCreate,
    and writes it asynchronously to MongoDB Atlas Cluster. 
    """
    sop_dict = sop.model_dump()
    now = datetime.now(timezone.utc)
    sop_dict["created_at"] = now
    sop_dict["updated_at"] = now
    if "db_instance" in locals():
        result = await db_instance["sops"].insert_one(sop_dict)
    else:
        result = await tickets_collection.database["sops"].insert_one(sop_dict)
    sop_dict["id"] = str(result.inserted_id)
    return sop_dict

@app.get("/api/sops", response_model=List[SOPResponse])
async def get_all_sops(tag: Optional[str]=None):
    """
    Retrieves all stored SOP rules from the database collection folder.
    Includes optional filter parameter to sort documents by their tags array.
    """

    query = {}
    if tag:
        query["tags"] = tag
    cursor = tickets_collection.database["sops"].find(query)
    sops = []
    for document in await cursor.to_list(length=100):
        document["id"] = str(document["_id"])
        del document["_id"]
        sops.append(document)
    return sops

@app.put("/api/sops/{sop_id}", response_model=SOPResponse)
async def update_sop(sop_id: str, sop: SOPCreate):
    """
    Updates an existing SOP document in the database by its unique ID.
    Validates incoming data with SOPCreate schema and returns the updated document.
    """
    if not ObjectId.is_valid(sop_id):
        raise HTTPException(status_code=400, detail="Invalid SOP ID format")
    sop_dict = sop.model_dump()
    sop_dict["updated_at"] = datetime.now(timezone.utc)
    if "db_instance" in locals():
        result = await db_instance["sops"].update_one({"_id": ObjectId(sop_id)}, {"$set": sop_dict})
    else:
        result = await tickets_collection.database["sops"].update_one({"_id": ObjectId(sop_id)}, {"$set": sop_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="SOP not found")

    updated_sop = await tickets_collection.database["sops"].find_one({"_id": ObjectId(sop_id)})
    updated_sop["id"] = str(updated_sop["_id"])
    del updated_sop["_id"]
    return updated_sop

@app.delete("/api/sops/{sop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sop(sop_id: str):
    """
    Deletes an existing SOP document from the database by its unique ID.
    """
    if not ObjectId.is_valid(sop_id):
        raise HTTPException(status_code=400, detail="Invalid SOP ID format")
    if "db_instance" in locals():
        result = await db_instance["sops"].delete_one({"_id": ObjectId(sop_id)})
    else:
        result = await tickets_collection.database["sops"].delete_one({"_id": ObjectId(sop_id)})
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

# Lightweight AI classifier: returns a category string or None
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