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
    tags: List[str] = Field(default={}, description="Keywords for sorting like ['billing', 'refund']")

class SOPCreate(SOPBase):
    pass

class SOPResponse(SOPBase):
    id: str

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True