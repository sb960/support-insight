from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from bson import ObjectId

class TicketRequest(BaseModel):
    message: str

class TicketAnalysis(BaseModel):
    id: Optional[str] = None
    category: str
    priority: str
    draft_reply: str
    reasoning: Optional[str] = None
    is_sop_compliant: bool = False
    confidence_score: float = 0.0
    sop_rules_followed: List[str] = []

class TicketResponse(BaseModel):
    id: str
    original_message: str
    category: str
    priority: str
    draft_reply: str
    created_at: datetime

class SOPBase(BaseModel):
    title: str = Field(..., description="Title of the operating procedure")
    content: str = Field(..., description="Detailed step-by-step instructions")
    tags: List[str] = Field(default=list(), description="Keywords for sorting like ['billing', 'refund']")

class SOPCreate(SOPBase):
    pass

class SOPResponse(SOPBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True