import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from bson import ObjectId

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")

client = AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB]
tickets_collection = db["tickets"]

async def test_connection():
    """Test MongoDB connection by pinging the server."""
    try:
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
        return True
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return False

async def save_ticket(original_message: str, category: str, priority: str, draft_reply: str, reasoning: str=None):
    """Save an analyzed ticket to the database."""
    ticket = {
        "original_message": original_message,
        "category": category,
        "priority": priority,
        "draft_reply": draft_reply,
        "reasoning": reasoning,
        "created_at": datetime.now(timezone.utc)
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

async def get_ticket_by_id(ticket_id: str):
    """Retrieve a single ticket by its ID."""
    doc = await tickets_collection.find_one({"_id": ObjectId(ticket_id)})
    if doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        return doc
    return None