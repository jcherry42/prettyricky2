"""
Health Monitor
Monitors health of all integrations and provides diagnostics

Features:
- Real-time health status
- Latency tracking
- Error rate monitoring
- Automatic health checks
- Alerting hooks
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum

from motor.motor_asyncio import AsyncIOMotorDatabase

from .base import BaseAdapter, ConnectionStatus, AdapterRegistry

logger = logging.getLogger(__name__)


class HealthStatus(str, Enum):
    """Overall health status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class IntegrationHealth:
    """Health information for a single integration"""
    integration_id: str
    integration_name: str
    adapter_type: str
    
    # Status
    status: HealthStatus = HealthStatus.UNKNOWN
    connection_status: ConnectionStatus = ConnectionStatus.UNKNOWN
    
    # Last check
    last_check: Optional[datetime] = None
    last_success: Optional[datetime] = None
    last_error: Optional[datetime] = None
    last_error_message: Optional[str] = None
    
    # Metrics
    uptime_percent: float = 100.0
    avg_latency_ms: float = 0.0
    error_rate: float = 0.0
    
    # Recent stats (last hour)
    requests_last_hour: int = 0
    errors_last_hour: int = 0
    
    # Sync status
    last_sync: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    records_synced: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "integration_id": self.integration_id,
            "integration_name": self.integration_name,
            "adapter_type": self.adapter_type,
            "status": self.status.value,
            "connection_status": self.connection_status.value,
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "last_success": self.last_success.isoformat() if self.last_success else None,
            "last_error": self.last_error.isoformat() if self.last_error else None,
            "last_error_message": self.last_error_message,
            "uptime_percent": round(self.uptime_percent, 2),
            "avg_latency_ms": round(self.avg_latency_ms, 2),
            "error_rate": round(self.error_rate, 4),
            "requests_last_hour": self.requests_last_hour,
            "errors_last_hour": self.errors_last_hour,
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
            "last_sync_status": self.last_sync_status,
            "records_synced": self.records_synced,
        }


class HealthMonitor:
    """
    Health monitoring system for integrations
    
    Provides:
    - Real-time health status for all integrations
    - Automatic health checks
    - Metrics collection
    - Alert hooks
    """
    
    HEALTH_CHECKS_COLLECTION = "health_checks"
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.health_checks = db[self.HEALTH_CHECKS_COLLECTION]
        
        # Cache of adapter instances
        self._adapters: Dict[str, BaseAdapter] = {}
        
        # Health cache
        self._health_cache: Dict[str, IntegrationHealth] = {}
        
        # Alert handlers
        self._alert_handlers: List[Callable] = []
        
        # Background task handle
        self._monitor_task: Optional[asyncio.Task] = None
    
    async def create_indexes(self):
        """Create database indexes"""
        await self.health_checks.create_index("integration_id")
        await self.health_checks.create_index("timestamp")
        # TTL index - keep health checks for 7 days
        await self.health_checks.create_index("timestamp", expireAfterSeconds=7*24*60*60)
    
    def register_adapter(self, integration_id: str, adapter: BaseAdapter):
        """Register an adapter for monitoring"""
        self._adapters[integration_id] = adapter
    
    def unregister_adapter(self, integration_id: str):
        """Unregister an adapter"""
        self._adapters.pop(integration_id, None)
        self._health_cache.pop(integration_id, None)
    
    def add_alert_handler(self, handler: Callable):
        """Add an alert handler (called when health degrades)"""
        self._alert_handlers.append(handler)
    
    async def check_health(self, integration_id: str) -> IntegrationHealth:
        """
        Check health of a specific integration
        
        Performs a connection test and updates health metrics.
        """
        adapter = self._adapters.get(integration_id)
        if not adapter:
            return IntegrationHealth(
                integration_id=integration_id,
                integration_name="Unknown",
                adapter_type="unknown",
                status=HealthStatus.UNKNOWN,
            )
        
        health = IntegrationHealth(
            integration_id=integration_id,
            integration_name=adapter.config.name,
            adapter_type=adapter.ADAPTER_TYPE,
        )
        
        # Perform connection test
        try:
            import time
            start = time.time()
            success, message = await adapter.test_connection()
            latency = (time.time() - start) * 1000
            
            health.last_check = datetime.now(timezone.utc)
            health.avg_latency_ms = latency
            
            if success:
                health.status = HealthStatus.HEALTHY
                health.connection_status = ConnectionStatus.HEALTHY
                health.last_success = health.last_check
            else:
                health.status = HealthStatus.UNHEALTHY
                health.connection_status = ConnectionStatus.UNHEALTHY
                health.last_error = health.last_check
                health.last_error_message = message
                
                # Trigger alert
                await self._trigger_alert(health)
                
        except Exception as e:
            health.status = HealthStatus.UNHEALTHY
            health.connection_status = ConnectionStatus.UNHEALTHY
            health.last_check = datetime.now(timezone.utc)
            health.last_error = health.last_check
            health.last_error_message = str(e)
            
            await self._trigger_alert(health)
        
        # Get adapter health metrics
        adapter_health = adapter.get_health()
        if "connection" in adapter_health:
            conn = adapter_health["connection"]
            health.error_rate = (
                conn.get("failed_requests", 0) / max(conn.get("total_requests", 1), 1)
            )
            health.uptime_percent = 100 - (health.error_rate * 100)
        
        # Store health check
        await self.health_checks.insert_one({
            "integration_id": integration_id,
            "timestamp": health.last_check,
            "status": health.status.value,
            "latency_ms": health.avg_latency_ms,
            "error_message": health.last_error_message,
        })
        
        # Update cache
        self._health_cache[integration_id] = health
        
        return health
    
    async def check_all_health(self) -> Dict[str, IntegrationHealth]:
        """Check health of all registered integrations"""
        results = {}
        
        for integration_id in self._adapters:
            try:
                health = await self.check_health(integration_id)
                results[integration_id] = health
            except Exception as e:
                logger.error(f"Health check failed for {integration_id}: {e}")
        
        return results
    
    async def get_health(self, integration_id: str) -> Optional[IntegrationHealth]:
        """Get cached health for an integration"""
        return self._health_cache.get(integration_id)
    
    async def get_all_health(self) -> Dict[str, IntegrationHealth]:
        """Get cached health for all integrations"""
        return self._health_cache.copy()
    
    async def get_health_history(
        self,
        integration_id: str,
        hours: int = 24,
    ) -> List[Dict[str, Any]]:
        """Get health check history for an integration"""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        
        cursor = self.health_checks.find({
            "integration_id": integration_id,
            "timestamp": {"$gte": since},
        }).sort("timestamp", -1)
        
        history = []
        async for doc in cursor:
            doc.pop("_id", None)
            history.append(doc)
        
        return history
    
    async def get_overall_health(self) -> Dict[str, Any]:
        """Get overall system health summary"""
        total = len(self._health_cache)
        healthy = sum(1 for h in self._health_cache.values() if h.status == HealthStatus.HEALTHY)
        degraded = sum(1 for h in self._health_cache.values() if h.status == HealthStatus.DEGRADED)
        unhealthy = sum(1 for h in self._health_cache.values() if h.status == HealthStatus.UNHEALTHY)
        
        # Determine overall status
        if unhealthy > 0:
            overall = HealthStatus.UNHEALTHY
        elif degraded > 0:
            overall = HealthStatus.DEGRADED
        elif healthy > 0:
            overall = HealthStatus.HEALTHY
        else:
            overall = HealthStatus.UNKNOWN
        
        return {
            "status": overall.value,
            "total_integrations": total,
            "healthy": healthy,
            "degraded": degraded,
            "unhealthy": unhealthy,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    async def _trigger_alert(self, health: IntegrationHealth):
        """Trigger alert handlers"""
        for handler in self._alert_handlers:
            try:
                await handler(health)
            except Exception as e:
                logger.error(f"Alert handler error: {e}")
    
    async def start_monitoring(self, check_interval_seconds: int = 300):
        """Start background health monitoring"""
        if self._monitor_task and not self._monitor_task.done():
            return
        
        async def monitor_loop():
            while True:
                try:
                    await self.check_all_health()
                except Exception as e:
                    logger.error(f"Health monitor error: {e}")
                
                await asyncio.sleep(check_interval_seconds)
        
        self._monitor_task = asyncio.create_task(monitor_loop())
        logger.info(f"Health monitoring started (interval: {check_interval_seconds}s)")
    
    async def stop_monitoring(self):
        """Stop background health monitoring"""
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
            self._monitor_task = None
            logger.info("Health monitoring stopped")
