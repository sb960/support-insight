from fastapi import FastAPI
from dotenv import load_dotenv
from database import test_connection

load_dotenv()

app = FastAPI(title="SupportInsightAPI", description="API for Support Insight", version="1.0.0")

@app.get("/")
def root():
    return {"message": "SupportInsight API is running!"}

@app.get("/health")
def health_check():
    db_ok = test_connection()
    return {"status": "healthy", "database": "connected" if db_ok else "disconnected"}