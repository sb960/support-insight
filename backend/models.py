from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

# ---------------------------------------------------------------------------
# Inbound / transient models (webhook body, AI output, PATCH payloads)
# ---------------------------------------------------------------------------

class TicketRequest(BaseModel):
    """Webhook ingest body — customer message only; tenant comes from API key."""
    message: str

class TicketAnalysis(BaseModel):
    """Internal AI pipeline result (not the persisted MongoDB document)."""
    id: Optional[str] = None
    category: str
    priority: str
    draft_reply: str
    reasoning: Optional[str] = None
    is_sop_compliant: bool = False
    confidence_score: float = 0.0
    sop_rules_followed: List[str] = Field(default_factory=list)


class TicketUpdateRequest(BaseModel):
    status: Optional[str] = None
    draft_reply: Optional[str] = None
    internal_notes: Optional[str] = None


class IngestAckResponse(BaseModel):
    status: str = "accepted"


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    company_name: str = Field(min_length=2, description="Corporate workspace name")


class RegisterResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant_id: str
    ingest_api_key: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    ingest_api_key: Optional[str] = None

# ---------------------------------------------------------------------------
# Persisted domain documents (MongoDB collections)
# ---------------------------------------------------------------------------

class TicketDocument(BaseModel):
    """Stored ticket row — always scoped to one corporate workspace."""
    id: str
    tenant_id: str = Field(..., description="Corporate workspace id, e.g. company_abc_123")
    original_message: str
    category: str
    priority: str
    draft_reply: str
    reasoning: Optional[str] = None
    is_sop_compliant: bool = False
    confidence_score: float = 0.0
    sop_rules_followed: List[str] = Field(default_factory=list)
    status: Optional[str] = None
    internal_notes: Optional[str] = None
    created_at: Optional[datetime] = None

class SopDocument(BaseModel):
    """Stored SOP row — always scoped to one corporate workspace."""
    id: str
    tenant_id: str = Field(..., description="Corporate workspace id, e.g. company_abc_123")
    title: str = Field(..., description="Title of the operating procedure")
    content: str = Field(..., description="Detailed step-by-step instructions")
    tags: List[str] = Field(
        default_factory=list,
        description="Keywords for sorting like ['billing', 'refund']",
    )
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class UserAccount(BaseModel):
    """Stored dashboard user — belongs to exactly one tenant."""
    id: Optional[str] = None
    email: str
    password_hash: str
    tenant_id: str = Field(..., description="Corporate workspace this user belongs to")
    role: Literal["admin", "agent"]

# ---------------------------------------------------------------------------
# Write / API DTOs (tenant_id injected server-side, never from client body)
# ---------------------------------------------------------------------------

class SOPCreate(BaseModel):
    title: str = Field(..., description="Title of the operating procedure")
    content: str = Field(..., description="Detailed step-by-step instructions")
    tags: List[str] = Field(
        default_factory=list,
        description="Keywords for sorting like ['billing', 'refund']",
    )

# ---------------------------------------------------------------------------
# Backward-compatible aliases (remove once main.py imports are updated)
# ---------------------------------------------------------------------------

TicketResponse = TicketDocument
SOPResponse = SopDocument

class BlogDraftDocument(BaseModel):
    id: Optional[str] = None
    tenant_id: str
    topic: str
    target_audience: Optional[str] = None

    title: Optional[str] = None
    slug: Optional[str] = None
    body_markdown: Optional[str] = None
    excerpt: Optional[str] = None
    seo_keywords: List[str] = Field(default_factory=list)

    status: Literal["processing", "pending_review", "published", "failed"] = "processing"

    created_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    cms_url: Optional[str] = None