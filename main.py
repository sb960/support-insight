import os
import json
from fastapi import FastAPI
from dotenv import load_dotenv
from database import test_connection
from openai import OpenAI
from models import TicketRequest, TicketAnalysis

load_dotenv()

app = FastAPI(title="SupportInsightAPI", description="API for Support Insight", version="1.0.0")

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

    system_prompt = """You are a customer support triage assistant. 
    Analyze the customer message and return a JSON object with:
    - category: one of [bug, feature_request, refund, complaint, other]
    - priority: one of [high, medium, low]
    - draft_reply: a professional draft response to the customer
    Always respond with valid JSON only, no other text."""

    response = deepseek_client.chat.completions.create(
        model="deepseek-chat",
        response_format={"type": "json_object"},
        messages= [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message}
        ]
    )

    result = json.loads(response.choices[0].message.content)
    return TicketAnalysis(**result)