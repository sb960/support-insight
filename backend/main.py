import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import test_connection, save_ticket, get_all_tickets, get_ticket_by_id, tickets_collection
from openai import OpenAI
from models import TicketRequest, TicketAnalysis, SOPCreate, SOPResponse
from fastapi import HTTPException, APIRouter, status
from typing import List, Optional
from bson import ObjectId
from datetime import datetime, timezone

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
    """Analyze a customer support message and return structured output."""

    system_prompt = """You are a customer support triage assistant for a SaaS company.
        Analyze the customer message and output a JSON object with exactly these fields:
        {
            "category": "bug" | "feature_request" | "refund" | "complaint" | "other",
            "priority": "high" | "medium" | "low",
            "draft_reply": "string containing a professional email reply",
            "reasoning": "brief explanation of why you chose this category and priority"
        }

        Category definitions:
        - bug: Something is broken or not working as expected
        - feature_request: User wants a new feature or improvement
        - refund: User wants money back
        - complaint: General dissatisfaction, not a specific bug
        - other: Doesn't fit any above

        Priority definitions:
        - high: Service down, billing issue, or angry customer
        - medium: Bug affecting workflow, but workaround exists
        - low: Feature request or minor issue

        The draft_reply should:
        - Be professional and empathetic
        - Acknowledge the issue
        - State what will happen next

        Output ONLY valid JSON. No other text."""

    try:
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            response_format={"type": "json_object"},
            messages= [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message}
            ]
        )

        content = response.choices[0].message.content
        result = json.loads(content)

        analysis = TicketAnalysis(
            category=result.get("category", "other"),
            priority=result.get("priority", "medium"),
            draft_reply=result.get("draft_reply", "Thank you for your message. We will get back to you shortly."),
            reasoning=result.get("reasoning")
        )

        ticket_id = await save_ticket(
            original_message=request.message,
            category=analysis.category,
            priority=analysis.priority,
            draft_reply=analysis.draft_reply,
            reasoning=analysis.reasoning
        )

        return analysis
     
    except json.JSONDecodeError:
        return TicketAnalysis(
            category="other",
            priority="medium",
            draft_reply="Thank you for your message. Our team will review this and respond shortly.",
            reasoning="AI response was not valid JSON"
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