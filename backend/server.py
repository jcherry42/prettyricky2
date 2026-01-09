from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

# Tower Talk - AI Request Model
class TowerTalkRequest(BaseModel):
    situation: str
    context: Dict[str, Any]

class TowerTalkResponse(BaseModel):
    response: str

# Tower Talk endpoint for AI-generated personalized responses
@api_router.post("/tower-talk", response_model=TowerTalkResponse)
async def tower_talk(request: TowerTalkRequest):
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Build the context-aware prompt
        ctx = request.context
        customer_name = ctx.get('customerName', 'the customer')
        vehicle = ctx.get('vehicle', 'the vehicle')
        vehicle_price = ctx.get('vehiclePrice', '')
        trade_in = ctx.get('tradeIn')
        dealership = ctx.get('dealershipName', 'our dealership')
        salesperson = ctx.get('salespersonName', 'the sales rep')
        style = ctx.get('salespersonStyle', 'friendly')
        
        # Map style to tone guidance
        style_guidance = {
            'straight_shooter': 'Be direct and honest. Get to the point quickly while remaining professional.',
            'friendly': 'Be warm, personable, and conversational. Build rapport while being helpful.',
            'professional': 'Be polished and formal. Maintain a business-like tone while being approachable.',
        }
        
        tone_guide = style_guidance.get(style, style_guidance['friendly'])
        
        system_message = f"""You are an expert automotive sales consultant helping craft personalized messages.

Your personality: {tone_guide}

Context:
- You work at {dealership}
- Your name is {salesperson}
- Customer: {customer_name}
- Vehicle of interest: {vehicle} {f'at {vehicle_price}' if vehicle_price else ''}
{f'- Customer has trade-in: {trade_in}' if trade_in else ''}

Rules:
1. Write a SINGLE message ready to send via text/iMessage
2. Keep it conversational and human - NOT salesy or pushy
3. Address the specific situation described
4. Be concise (2-4 sentences max)
5. Sign off with just the salesperson's first name
6. DO NOT use emojis
7. DO NOT include any brackets or placeholders
8. Make it feel genuine and helpful"""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"tower-talk-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("openai", "gpt-4.1-mini")
        
        user_message = UserMessage(
            text=f"Situation: {request.situation}\n\nWrite a personalized message for this situation."
        )
        
        response = await chat.send_message(user_message)
        
        return TowerTalkResponse(response=response.strip())
        
    except Exception as e:
        logger.error(f"Tower Talk error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate response")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()