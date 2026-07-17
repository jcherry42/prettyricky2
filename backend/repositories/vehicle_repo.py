"""
Vehicle Repository
Handles vehicle inventory persistence with performance optimization
"""

from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, TEXT

from .base import BaseRepository


class VehicleRepository(BaseRepository):
    """Repository for vehicle inventory data"""

    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "vehicles")

    async def create_indexes(self):
        """Create indexes for efficient queries"""
        await self.collection.create_index([("vin", ASCENDING)], sparse=True)
        await self.collection.create_index([("stock_number", ASCENDING)], sparse=True)
        await self.collection.create_index([("year", DESCENDING), ("make", ASCENDING), ("model", ASCENDING)])
        await self.collection.create_index([("status", ASCENDING)])
        await self.collection.create_index([("is_new", ASCENDING)])
        await self.collection.create_index([("price", ASCENDING)], sparse=True)
        await self.collection.create_index([
            ("make", TEXT),
            ("model", TEXT),
            ("trim", TEXT),
        ])

    async def find_by_vin(self, vin: str) -> Optional[Dict[str, Any]]:
        """Find vehicle by VIN"""
        doc = await self.collection.find_one({"vin": vin.upper()})
        return self._convert_doc(doc) if doc else None

    async def find_by_stock_number(self, stock_number: str) -> Optional[Dict[str, Any]]:
        """Find vehicle by stock number"""
        doc = await self.collection.find_one({"stock_number": stock_number})
        return self._convert_doc(doc) if doc else None

    async def find_available(
        self,
        is_new: Optional[bool] = None,
        limit: int = 100,
        skip: int = 0,
    ) -> List[Dict[str, Any]]:
        """Find available vehicles"""
        query: Dict[str, Any] = {"status": "available"}
        if is_new is not None:
            query["is_new"] = is_new

        return await self.find_many(
            query,
            limit=limit,
            skip=skip,
            sort=[("year", DESCENDING), ("make", ASCENDING)],
        )

    async def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Full-text search vehicles"""
        if not query:
            return []
        docs = await self.collection.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}},
        ).sort([("score", {"$meta": "textScore"})]).limit(limit).to_list(limit)
        return [self._convert_doc(doc) for doc in docs]

    async def get_inventory_summary(self) -> Dict[str, Any]:
        """Get inventory summary statistics"""
        pipeline = [
            {"$match": {}},
            {"$group": {
                "_id": None,
                "total": {"$sum": 1},
                "new_count": {"$sum": {"$cond": ["$is_new", 1, 0]}},
                "used_count": {"$sum": {"$cond": ["$is_new", 0, 1]}},
                "available_count": {"$sum": {"$cond": [{"$eq": ["$status", "available"]}, 1, 0]}},
                "avg_price": {"$avg": "$price"},
                "min_price": {"$min": "$price"},
                "max_price": {"$max": "$price"},
            }},
        ]

        results = await self.collection.aggregate(pipeline).to_list(1)

        if results:
            r = results[0]
            return {
                "total": r.get('total', 0),
                "new": r.get('new_count', 0),
                "used": r.get('used_count', 0),
                "available": r.get('available_count', 0),
                "avgPrice": round(r.get('avg_price', 0) or 0, 2),
                "minPrice": r.get('min_price'),
                "maxPrice": r.get('max_price'),
            }

        return {
            "total": 0, "new": 0, "used": 0, "available": 0,
            "avgPrice": 0, "minPrice": None, "maxPrice": None,
        }

    def to_frontend_format(self, vehicles: List[Dict[str, Any]], summary: bool = False) -> List[Dict[str, Any]]:
        """Convert vehicles to camelCase shape expected by the mobile UI."""
        result = []
        for v in vehicles:
            if summary:
                result.append({
                    "id": v.get('id'),
                    "title": f"{v.get('year', '')} {v.get('make', '')} {v.get('model', '')}".strip(),
                    "price": f"${v.get('price', 0):,.0f}" if v.get('price') else "Call",
                    "stockNumber": v.get('stock_number', ''),
                    "isNew": v.get('is_new', True),
                })
            else:
                result.append({
                    "id": v.get('id'),
                    "year": v.get('year'),
                    "make": v.get('make', ''),
                    "model": v.get('model', ''),
                    "trim": v.get('trim', ''),
                    "title": f"{v.get('year', '')} {v.get('make', '')} {v.get('model', '')}".strip(),
                    "price": v.get('price'),
                    "formattedPrice": f"${v.get('price', 0):,.0f}" if v.get('price') else "Call",
                    "msrp": v.get('msrp'),
                    "vin": v.get('vin', ''),
                    "stockNumber": v.get('stock_number', ''),
                    "mileage": v.get('mileage'),
                    "exteriorColor": v.get('exterior_color', ''),
                    "interiorColor": v.get('interior_color', ''),
                    "transmission": v.get('transmission', ''),
                    "engine": v.get('engine', ''),
                    "fuelType": v.get('fuel_type', ''),
                    "bodyStyle": v.get('body_style', ''),
                    "drivetrain": v.get('drivetrain', ''),
                    "status": v.get('status', 'available'),
                    "isNew": v.get('is_new', True),
                    "imageUrl": v.get('image_url', ''),
                    "carfax_clean": v.get('carfax_clean'),
                })
        return result
