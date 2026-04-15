from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TicketRequest(BaseModel):
    message: str

class TicketAnalysis(BaseModel):
    category: str
    priority: str
    draft_reply: str
    reasoning: Optional[str] = None

class TicketResponse(BaseModel):
    id: str
    original_message: str
    category: str
    priority: str
    draft_reply: str
    created_at: datetime