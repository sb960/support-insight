import os
import json
from fastapi import FastAPI
from dotenv import load_dotenv
from database import test_connection
from openai import OpenAI
from models import TicketRequest, TicketAnalysis
from fastapi import HTTPException

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
