import os
import re
import secrets
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")

client = AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB]
tickets_collection = db["tickets"]
api_keys_collection = db["tenant_api_keys"]
users_collection = db["users"]
sops_collection = db["sops"]

async def test_connection():
    """Test MongoDB connection by pinging the server."""
    try:
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
        return True
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return False

async def resolve_tenant_from_api_key(api_key: str) -> Optional[str]:
    """Map an inbound webhook API key to a corporate tenant_id."""
    if not api_key:
        return None

    dev_key = os.getenv("INGEST_API_KEY")
    dev_tenant = os.getenv("INGEST_TENANT_ID", "default_tenant")
    if dev_key and api_key == dev_key:
        return dev_tenant

    doc = await api_keys_collection.find_one({"api_key": api_key, "active": True})
    if doc:
        return doc.get("tenant_id")
    return None


async def save_ticket(
    original_message: str,
    category: str,
    priority: str,
    draft_reply: str,
    tenant_id: str,
    reasoning: str | None = None,
    confidence_score: float = 0.0,
    is_sop_compliant: bool = False,
    sop_rules_followed: list | None = None,
    status: str = "Auto-Drafted",
    internal_notes: str | None = None,
):
    """Save an analyzed ticket including audit fields."""
    now = datetime.now(timezone.utc)
    ticket = {
        "tenant_id": tenant_id,
        "original_message": original_message,
        "category": category,
        "priority": priority,
        "draft_reply": draft_reply,
        "reasoning": reasoning,
        "confidence_score": float(confidence_score or 0.0),
        "is_sop_compliant": bool(is_sop_compliant),
        "sop_rules_followed": sop_rules_followed or [],
        "status": status,
        "internal_notes": internal_notes,
        "created_at": now,
    }
    result = await tickets_collection.insert_one(ticket)
    return str(result.inserted_id)

async def get_all_tickets(limit: int = 50):
    """Retrieve all tickets, most recent first."""
    cursor = tickets_collection.find().sort("created_at", -1).limit(limit)
    tickets = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        tickets.append(doc)
    return tickets

async def get_user_by_email(email: str) -> Optional[dict]:
    return await users_collection.find_one({"email": email.lower().strip()})


def slugify_tenant_id(company_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", company_name.lower()).strip("_")
    return slug or "workspace"


async def tenant_workspace_exists(tenant_id: str) -> bool:
    doc = await users_collection.find_one({"tenant_id": tenant_id})
    return doc is not None


async def create_user(
    email: str,
    password_hash: str,
    tenant_id: str,
    role: str,
) -> str:
    result = await users_collection.insert_one(
        {
            "email": email.lower().strip(),
            "password_hash": password_hash,
            "tenant_id": tenant_id,
            "role": role,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return str(result.inserted_id)


async def create_tenant_api_key(tenant_id: str) -> str:
    api_key = f"si_{secrets.token_urlsafe(32)}"
    await api_keys_collection.insert_one(
        {
            "api_key": api_key,
            "tenant_id": tenant_id,
            "active": True,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return api_key


async def get_active_api_key_for_tenant(tenant_id: str) -> Optional[str]:
    """Return the active webhook API key for a tenant, if any."""
    doc = await api_keys_collection.find_one({"tenant_id": tenant_id, "active": True})
    if doc:
        return doc.get("api_key")

    dev_tenant = os.getenv("INGEST_TENANT_ID", "default_tenant")
    dev_key = os.getenv("INGEST_API_KEY")
    if dev_key and tenant_id == dev_tenant:
        return dev_key
    return None


async def get_ticket_by_id(ticket_id: str, tenant_id: Optional[str] = None) -> Optional[dict]:
    """Retrieve a single ticket by its ID, optionally scoped to a tenant."""
    query: dict = {"_id": ObjectId(ticket_id)}
    if tenant_id:
        query["tenant_id"] = tenant_id
    doc = await tickets_collection.find_one(query)
    if doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        return doc
    return None

async def get_sop_by_tag(tag: str, tenant_id: Optional[str] = None) -> Optional[dict]:
    """Return one SOP document whose `tags` array contains `tag` (string match)."""
    if not tag:
        return None
    coll = sops_collection
    query: dict = {"tags": tag}
    if tenant_id:
        query["tenant_id"] = tenant_id
    doc = await coll.find_one(query)
    if not doc:
        return None
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc