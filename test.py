import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB")

print(f"MONGO_URI: {MONGO_URI}")
print(f"MONGO_DB: {MONGO_DB}")