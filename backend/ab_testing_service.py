"""
A/B Testing Framework
Track and analyze feature variants for sales effectiveness optimization
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import random
import hashlib
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase


class Experiment(BaseModel):
    """A/B Test Experiment configuration"""
    experiment_id: str
    name: str
    description: str
    variants: List[Dict[str, Any]]  # [{"id": "A", "name": "Control", "weight": 50}, ...]
    start_date: datetime = None
    end_date: datetime = None
    is_active: bool = True
    targeting: Dict[str, Any] = {}  # Optional targeting rules


class ABTestingService:
    """
    A/B Testing service for CLOSR
    
    Features:
    - Experiment management (create, activate, deactivate)
    - Deterministic user assignment (same user always sees same variant)
    - Event tracking (impressions, conversions)
    - Analytics aggregation
    """
    
    def __init__(self):
        self.db: Optional[AsyncIOMotorDatabase] = None
        self._initialized = False
    
    async def initialize(self, db: AsyncIOMotorDatabase):
        """Initialize with database connection"""
        self.db = db
        self._initialized = True
        
        # Create indexes
        await self.db.experiments.create_index("experiment_id", unique=True)
        await self.db.ab_events.create_index([("experiment_id", 1), ("created_at", -1)])
        await self.db.ab_assignments.create_index([("user_id", 1), ("experiment_id", 1)], unique=True)
    
    def _get_deterministic_variant(self, user_id: str, experiment_id: str, variants: List[Dict]) -> Dict:
        """
        Deterministically assign a user to a variant based on hash
        Same user always gets same variant for same experiment
        """
        # Create hash from user_id + experiment_id
        hash_input = f"{user_id}:{experiment_id}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
        
        # Calculate total weight
        total_weight = sum(v.get("weight", 50) for v in variants)
        
        # Map hash to weight range
        target = hash_value % total_weight
        cumulative = 0
        
        for variant in variants:
            cumulative += variant.get("weight", 50)
            if target < cumulative:
                return variant
        
        return variants[-1]  # Fallback to last variant
    
    async def create_experiment(self, experiment: Experiment) -> Dict[str, Any]:
        """Create a new A/B experiment"""
        if not self._initialized:
            raise RuntimeError("Service not initialized")
        
        doc = {
            "experiment_id": experiment.experiment_id,
            "name": experiment.name,
            "description": experiment.description,
            "variants": experiment.variants,
            "start_date": experiment.start_date or datetime.now(timezone.utc),
            "end_date": experiment.end_date,
            "is_active": experiment.is_active,
            "targeting": experiment.targeting,
            "created_at": datetime.now(timezone.utc),
        }
        
        await self.db.experiments.update_one(
            {"experiment_id": experiment.experiment_id},
            {"$set": doc},
            upsert=True
        )
        
        return {"success": True, "experiment_id": experiment.experiment_id}
    
    async def get_variant(self, user_id: str, experiment_id: str) -> Optional[Dict[str, Any]]:
        """Get the assigned variant for a user in an experiment"""
        if not self._initialized:
            return None
        
        # Check for existing assignment
        existing = await self.db.ab_assignments.find_one({
            "user_id": user_id,
            "experiment_id": experiment_id
        })
        
        if existing:
            return {"variant_id": existing["variant_id"], "variant_name": existing.get("variant_name")}
        
        # Get experiment
        experiment = await self.db.experiments.find_one({
            "experiment_id": experiment_id,
            "is_active": True
        })
        
        if not experiment:
            return None
        
        # Assign variant
        variant = self._get_deterministic_variant(user_id, experiment_id, experiment["variants"])
        
        # Store assignment
        await self.db.ab_assignments.update_one(
            {"user_id": user_id, "experiment_id": experiment_id},
            {"$set": {
                "user_id": user_id,
                "experiment_id": experiment_id,
                "variant_id": variant["id"],
                "variant_name": variant.get("name"),
                "assigned_at": datetime.now(timezone.utc)
            }},
            upsert=True
        )
        
        return {"variant_id": variant["id"], "variant_name": variant.get("name")}
    
    async def track_event(
        self, 
        experiment_id: str, 
        user_id: str, 
        event_type: str,  # "impression", "conversion", "click", etc.
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Track an event for an experiment"""
        if not self._initialized:
            return {"success": False, "error": "Service not initialized"}
        
        # Get user's variant assignment
        assignment = await self.db.ab_assignments.find_one({
            "user_id": user_id,
            "experiment_id": experiment_id
        })
        
        variant_id = assignment["variant_id"] if assignment else "unassigned"
        
        event = {
            "experiment_id": experiment_id,
            "user_id": user_id,
            "variant_id": variant_id,
            "event_type": event_type,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.db.ab_events.insert_one(event)
        
        return {"success": True, "variant_id": variant_id}
    
    async def get_experiment_results(self, experiment_id: str) -> Dict[str, Any]:
        """Get aggregated results for an experiment"""
        if not self._initialized:
            return {}
        
        experiment = await self.db.experiments.find_one({"experiment_id": experiment_id})
        if not experiment:
            return {"error": "Experiment not found"}
        
        # Aggregate events by variant
        pipeline = [
            {"$match": {"experiment_id": experiment_id}},
            {"$group": {
                "_id": {"variant_id": "$variant_id", "event_type": "$event_type"},
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = self.db.ab_events.aggregate(pipeline)
        events = await cursor.to_list(100)
        
        # Organize by variant
        results = {}
        for event in events:
            variant_id = event["_id"]["variant_id"]
            event_type = event["_id"]["event_type"]
            
            if variant_id not in results:
                results[variant_id] = {"impressions": 0, "conversions": 0, "clicks": 0}
            
            results[variant_id][event_type + "s" if not event_type.endswith("s") else event_type] = event["count"]
        
        # Calculate conversion rates
        for variant_id, data in results.items():
            impressions = data.get("impressions", 0)
            conversions = data.get("conversions", 0)
            data["conversion_rate"] = (conversions / impressions * 100) if impressions > 0 else 0
        
        # Get assignment counts
        assign_pipeline = [
            {"$match": {"experiment_id": experiment_id}},
            {"$group": {"_id": "$variant_id", "users": {"$sum": 1}}}
        ]
        
        assign_cursor = self.db.ab_assignments.aggregate(assign_pipeline)
        assignments = await assign_cursor.to_list(100)
        
        for assign in assignments:
            variant_id = assign["_id"]
            if variant_id in results:
                results[variant_id]["users"] = assign["users"]
        
        return {
            "experiment_id": experiment_id,
            "name": experiment.get("name"),
            "is_active": experiment.get("is_active"),
            "variants": experiment.get("variants"),
            "results": results,
            "start_date": experiment.get("start_date"),
        }
    
    async def list_experiments(self, active_only: bool = False) -> List[Dict[str, Any]]:
        """List all experiments"""
        if not self._initialized:
            return []
        
        query = {"is_active": True} if active_only else {}
        cursor = self.db.experiments.find(query, {"_id": 0})
        experiments = await cursor.to_list(100)
        return experiments
    
    async def toggle_experiment(self, experiment_id: str, is_active: bool) -> Dict[str, Any]:
        """Activate or deactivate an experiment"""
        if not self._initialized:
            return {"success": False}
        
        result = await self.db.experiments.update_one(
            {"experiment_id": experiment_id},
            {"$set": {"is_active": is_active}}
        )
        
        return {"success": result.modified_count > 0, "is_active": is_active}


# Pre-configured experiments for CLOSR
DEFAULT_EXPERIMENTS = [
    {
        "experiment_id": "tone_effectiveness",
        "name": "Response Tone Effectiveness",
        "description": "Track which tone (professional, friendly, balanced) leads to more customer engagement",
        "variants": [
            {"id": "A", "name": "Default Order", "weight": 33},
            {"id": "B", "name": "Friendly First", "weight": 33},
            {"id": "C", "name": "Professional First", "weight": 34}
        ]
    },
    {
        "experiment_id": "shortcut_vs_tower",
        "name": "Quick Shortcuts vs Tower Talk",
        "description": "Compare usage of pre-defined shortcuts vs custom Tower Talk queries",
        "variants": [
            {"id": "control", "name": "Both Visible", "weight": 50},
            {"id": "shortcuts_prominent", "name": "Shortcuts Prominent", "weight": 50}
        ]
    },
    {
        "experiment_id": "response_length",
        "name": "Response Length Preference",
        "description": "Test short vs medium vs long AI-generated responses",
        "variants": [
            {"id": "short", "name": "Concise (2-3 sentences)", "weight": 33},
            {"id": "medium", "name": "Standard (4-5 sentences)", "weight": 34},
            {"id": "long", "name": "Detailed (6+ sentences)", "weight": 33}
        ]
    },
    {
        "experiment_id": "vs_card_layout",
        "name": "VS Battle Card Layout",
        "description": "Test different layouts for competitor comparison cards",
        "variants": [
            {"id": "split", "name": "Split View", "weight": 50},
            {"id": "tabbed", "name": "Tabbed View", "weight": 50}
        ]
    }
]


# Singleton instance
ab_testing_service = ABTestingService()
