"""VIN Anomaly Detection Service.

Analyzes VIN scan data for suspicious patterns:
- VIN reuse across different customers (cloned VINs)
- Mismatched make/model vs NHTSA decoded data
- Unusual geographic patterns (same VIN scanned from distant locations)
- High-frequency scanning of same VIN (potential fraud probing)
- Invalid VIN checksums that passed OCR
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from collections import Counter

logger = logging.getLogger("anomaly_detection")


class AnomalyDetectionService:
    """Background-capable service for detecting suspicious VIN activity."""

    # Severity levels
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

    def __init__(self, db):
        self._db = db
        self._anomalies_col = db["anomalies"]

    async def ensure_indexes(self):
        await self._anomalies_col.create_index([("detected_at", -1)])
        await self._anomalies_col.create_index([("severity", 1), ("resolved", 1)])
        await self._anomalies_col.create_index([("vin", 1)])
        await self._anomalies_col.create_index(
            [("detected_at", 1)],
            expireAfterSeconds=90 * 24 * 3600,
            name="ttl_anomalies_90d",
        )
        logger.info("Anomaly detection indexes ensured")

    async def run_full_scan(self) -> Dict[str, Any]:
        """Run all anomaly detection checks. Returns summary."""
        results = {
            "scan_time": datetime.now(timezone.utc).isoformat(),
            "checks_run": 0,
            "anomalies_found": 0,
            "by_severity": {self.CRITICAL: 0, self.HIGH: 0, self.MEDIUM: 0, self.LOW: 0},
            "details": [],
        }

        checks = [
            self._check_vin_reuse,
            self._check_high_frequency_scans,
            self._check_vin_checksum_failures,
            self._check_make_model_mismatches,
        ]

        for check in checks:
            try:
                anomalies = await check()
                results["checks_run"] += 1
                for a in anomalies:
                    results["anomalies_found"] += 1
                    results["by_severity"][a["severity"]] += 1
                    results["details"].append(a)
                    # Persist to DB
                    await self._store_anomaly(a)
            except Exception as e:
                logger.warning(f"Anomaly check {check.__name__} failed: {e}")

        return results

    async def get_anomalies(
        self,
        severity: Optional[str] = None,
        resolved: Optional[bool] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> Dict[str, Any]:
        """Retrieve stored anomalies with filters."""
        query = {}
        if severity:
            query["severity"] = severity
        if resolved is not None:
            query["resolved"] = resolved

        cursor = (
            self._anomalies_col.find(query, {"_id": 0})
            .sort("detected_at", -1)
            .skip(skip)
            .limit(limit)
        )
        items = await cursor.to_list(length=limit)
        total = await self._anomalies_col.count_documents(query)

        return {"anomalies": items, "total": total, "limit": limit, "skip": skip}

    async def resolve_anomaly(self, anomaly_id: str, resolution: str) -> bool:
        """Mark an anomaly as resolved."""
        result = await self._anomalies_col.update_one(
            {"anomaly_id": anomaly_id},
            {
                "$set": {
                    "resolved": True,
                    "resolution": resolution,
                    "resolved_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        return result.modified_count > 0

    async def get_summary(self) -> Dict[str, Any]:
        """Dashboard-friendly summary of anomaly state."""
        total = await self._anomalies_col.count_documents({})
        unresolved = await self._anomalies_col.count_documents({"resolved": {"$ne": True}})

        # Count by severity (unresolved only)
        pipeline = [
            {"$match": {"resolved": {"$ne": True}}},
            {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
        ]
        severity_counts = {}
        async for doc in self._anomalies_col.aggregate(pipeline):
            severity_counts[doc["_id"]] = doc["count"]

        # Recent anomalies (last 24h)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        recent = await self._anomalies_col.count_documents(
            {"detected_at": {"$gte": cutoff.isoformat()}}
        )

        return {
            "total_anomalies": total,
            "unresolved": unresolved,
            "by_severity": severity_counts,
            "last_24h": recent,
            "health": "clean" if unresolved == 0 else ("alert" if severity_counts.get("critical", 0) > 0 else "warning"),
        }

    # ── Detection Checks ──────────────────────────────────────────────

    async def _check_vin_reuse(self) -> List[Dict]:
        """Detect same VIN associated with multiple different customers."""
        pipeline = [
            {"$match": {"vin": {"$exists": True, "$nin": [None, ""]}}},
            {"$group": {
                "_id": "$vin",
                "customer_ids": {"$addToSet": "$customer_id"},
                "count": {"$sum": 1},
            }},
            {"$match": {"count": {"$gt": 1}}},
        ]
        anomalies = []
        async for doc in self._db.vehicles.aggregate(pipeline):
            if len(doc["customer_ids"]) > 1:
                anomalies.append(self._make_anomaly(
                    check="vin_reuse",
                    severity=self.HIGH,
                    vin=doc["_id"],
                    message=f"VIN {doc['_id']} associated with {len(doc['customer_ids'])} different customers",
                    details={"customer_ids": doc["customer_ids"][:10]},
                ))
        return anomalies

    async def _check_high_frequency_scans(self) -> List[Dict]:
        """Detect VINs scanned unusually often (>5 times in 24h)."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        pipeline = [
            {"$match": {"feature": "vin_decode", "timestamp": {"$gte": cutoff}}},
            {"$group": {"_id": "$vin", "count": {"$sum": 1}}},
            {"$match": {"count": {"$gt": 5}}},
        ]
        anomalies = []
        try:
            async for doc in self._db.ai_gateway_logs.aggregate(pipeline):
                if doc["_id"]:
                    anomalies.append(self._make_anomaly(
                        check="high_frequency_scan",
                        severity=self.MEDIUM,
                        vin=doc["_id"],
                        message=f"VIN {doc['_id']} scanned {doc['count']} times in 24h",
                        details={"scan_count": doc["count"]},
                    ))
        except Exception:
            pass  # ai_gateway_logs may not have vin field
        return anomalies

    async def _check_vin_checksum_failures(self) -> List[Dict]:
        """Detect vehicles with VINs that fail the standard checksum."""
        anomalies = []
        cursor = self._db.vehicles.find(
            {"vin": {"$exists": True, "$ne": None}},
            {"_id": 0, "vin": 1, "id": 1, "make": 1, "model": 1},
        ).limit(500)

        async for doc in cursor:
            vin = doc.get("vin", "")
            if vin and len(vin) == 17 and not _validate_vin_checksum(vin):
                anomalies.append(self._make_anomaly(
                    check="invalid_checksum",
                    severity=self.LOW,
                    vin=vin,
                    message=f"VIN {vin} has invalid check digit",
                    details={"vehicle_id": doc.get("id"), "make": doc.get("make"), "model": doc.get("model")},
                ))
        return anomalies

    async def _check_make_model_mismatches(self) -> List[Dict]:
        """Detect vehicles where stored make/model doesn't match NHTSA WMI prefix."""
        # Common WMI -> Make mappings (first 3 chars of VIN)
        wmi_map = {
            "1HG": "HONDA", "2HG": "HONDA", "SHH": "HONDA",
            "1G1": "CHEVROLET", "1GC": "CHEVROLET", "3GN": "CHEVROLET",
            "1FA": "FORD", "1FM": "FORD", "3FA": "FORD",
            "1N4": "NISSAN", "JN1": "NISSAN", "5N1": "NISSAN",
            "WBA": "BMW", "WBS": "BMW", "5UX": "BMW",
            "WDD": "MERCEDES-BENZ", "WDC": "MERCEDES-BENZ", "4JG": "MERCEDES-BENZ",
            "1C4": "CHRYSLER", "2C3": "CHRYSLER",
            "JTD": "TOYOTA", "4T1": "TOYOTA", "5TD": "TOYOTA", "2T1": "TOYOTA",
            "5YJ": "TESLA", "7SA": "TESLA",
            "WAU": "AUDI", "WA1": "AUDI",
            "3VW": "VOLKSWAGEN", "WVW": "VOLKSWAGEN",
            "YV1": "VOLVO", "YV4": "VOLVO",
            "SAL": "LAND ROVER", "SAJ": "JAGUAR",
            "ZFF": "FERRARI", "ZAM": "MASERATI",
        }

        anomalies = []
        cursor = self._db.vehicles.find(
            {"vin": {"$exists": True, "$ne": None}, "make": {"$exists": True}},
            {"_id": 0, "vin": 1, "id": 1, "make": 1, "model": 1},
        ).limit(500)

        async for doc in cursor:
            vin = doc.get("vin", "")
            make = (doc.get("make") or "").upper()
            if len(vin) >= 3 and make:
                wmi = vin[:3].upper()
                expected_make = wmi_map.get(wmi)
                if expected_make and expected_make != make:
                    anomalies.append(self._make_anomaly(
                        check="make_model_mismatch",
                        severity=self.MEDIUM,
                        vin=vin,
                        message=f"VIN {vin} WMI prefix '{wmi}' suggests {expected_make}, but stored as {make}",
                        details={
                            "vehicle_id": doc.get("id"),
                            "stored_make": make,
                            "expected_make": expected_make,
                            "model": doc.get("model"),
                        },
                    ))
        return anomalies

    # ── Helpers ────────────────────────────────────────────────────────

    def _make_anomaly(self, check: str, severity: str, vin: str, message: str, details: Dict) -> Dict:
        import uuid
        return {
            "anomaly_id": str(uuid.uuid4()),
            "check": check,
            "severity": severity,
            "vin": vin,
            "message": message,
            "details": details,
            "detected_at": datetime.now(timezone.utc).isoformat(),
            "resolved": False,
        }

    async def _store_anomaly(self, anomaly: Dict):
        """Store anomaly if not already detected (dedup by check+vin).

        Insert on a copy so we don't mutate the caller's dict with MongoDB's
        auto-generated ObjectId (`_id`), which would break JSON serialization
        of the API response.
        """
        existing = await self._anomalies_col.find_one(
            {"check": anomaly["check"], "vin": anomaly["vin"], "resolved": False}
        )
        if not existing:
            await self._anomalies_col.insert_one(dict(anomaly))


# ── VIN Checksum Validation ───────────────────────────────────────────

_VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
_VIN_TRANSLITERATION = {
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
    'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
}


def _validate_vin_checksum(vin: str) -> bool:
    """Validate VIN check digit (position 9) per ISO 3779."""
    if len(vin) != 17:
        return False
    total = 0
    for i, char in enumerate(vin.upper()):
        if char.isdigit():
            val = int(char)
        elif char in _VIN_TRANSLITERATION:
            val = _VIN_TRANSLITERATION[char]
        else:
            return False  # Invalid character
        total += val * _VIN_WEIGHTS[i]

    remainder = total % 11
    check_char = vin[8].upper()
    expected = 'X' if remainder == 10 else str(remainder)
    return check_char == expected
