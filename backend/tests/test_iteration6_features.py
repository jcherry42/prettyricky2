"""Tests for iteration 6 features: TTL indexes, API versioning, diagnostics, services reorganization.

This file focuses on NEW features added in the modernization phase:
- TTL indexes for data expiration (ai_gateway_logs, telemetry_events, _diagnostics)
- API versioning via /api/v2/* middleware
- Diagnostics endpoint with 7 system probes
- Backend file reorganization (services/ directory)
- Pydantic response models validation
- Rate limiter loopback exemption
"""

import pytest
import httpx
from motor.motor_asyncio import AsyncIOMotorClient

BASE = "http://localhost:8001"


class TestTTLIndexes:
    """Verify TTL indexes are created for automatic data expiration."""

    @pytest.mark.asyncio
    async def test_ai_gateway_logs_ttl_30d(self):
        """ai_gateway_logs should have 30-day TTL index."""
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["test_database"]
        try:
            indexes = await db.ai_gateway_logs.index_information()
            ttl_idx = next(
                (v for k, v in indexes.items() if "expireAfterSeconds" in v and v.get("key") == [("timestamp", 1)]),
                None
            )
            assert ttl_idx is not None, "TTL index on timestamp not found"
            assert ttl_idx["expireAfterSeconds"] == 30 * 24 * 3600  # 30 days
        finally:
            client.close()

    @pytest.mark.asyncio
    async def test_telemetry_events_ttl_90d(self):
        """telemetry_events should have 90-day TTL index."""
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["test_database"]
        try:
            indexes = await db.telemetry_events.index_information()
            ttl_idx = next(
                (v for k, v in indexes.items() if "expireAfterSeconds" in v and v.get("key") == [("timestamp", 1)]),
                None
            )
            assert ttl_idx is not None, "TTL index on timestamp not found"
            assert ttl_idx["expireAfterSeconds"] == 90 * 24 * 3600  # 90 days
        finally:
            client.close()

    @pytest.mark.asyncio
    async def test_diagnostics_ttl_1h(self):
        """_diagnostics collection should have 1-hour TTL index."""
        client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = client["test_database"]
        try:
            indexes = await db["_diagnostics"].index_information()
            ttl_idx = next(
                (v for k, v in indexes.items() if "expireAfterSeconds" in v and v.get("key") == [("ts", 1)]),
                None
            )
            assert ttl_idx is not None, "TTL index on ts not found"
            assert ttl_idx["expireAfterSeconds"] == 3600  # 1 hour
        finally:
            client.close()


class TestAPIVersioning:
    """Test /api/v2/* routes work via middleware path rewrite."""

    @pytest.mark.asyncio
    async def test_v2_health_same_as_api_health(self):
        """GET /api/v2/health should return same data as GET /api/health."""
        async with httpx.AsyncClient() as client:
            r1 = await client.get(f"{BASE}/api/health")
            r2 = await client.get(f"{BASE}/api/v2/health")
            assert r1.status_code == 200
            assert r2.status_code == 200
            d1 = r1.json()
            d2 = r2.json()
            assert d1["version"] == d2["version"] == "2.1.0"
            assert d1["status"] == d2["status"]

    @pytest.mark.asyncio
    async def test_v2_root_endpoint(self):
        """GET /api/v2 should return same as GET /api/."""
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/v2")
            # Middleware rewrites to /api/, follow redirect if needed
            assert r.status_code in (200, 307)
            if r.status_code == 200:
                data = r.json()
                assert data["version"] == "2.1.0"

    @pytest.mark.asyncio
    async def test_v2_vin_trade_in_count(self):
        """GET /api/v2/vin/trade-in-count should work."""
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/v2/vin/trade-in-count")
            assert r.status_code == 200
            data = r.json()
            assert "count" in data
            assert "cap" in data
            assert "remaining" in data
            assert "at_limit" in data

    @pytest.mark.asyncio
    async def test_v2_customers_list(self):
        """GET /api/v2/customers?limit=1 should work."""
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/v2/customers?limit=1")
            assert r.status_code == 200
            data = r.json()
            assert "customers" in data
            assert "count" in data

    @pytest.mark.asyncio
    async def test_v2_diagnostics(self):
        """GET /api/v2/diagnostics should work with all probes."""
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{BASE}/api/v2/diagnostics")
            assert r.status_code == 200
            data = r.json()
            assert "status" in data
            assert "summary" in data
            assert data["summary"]["total"] == 7


class TestDiagnosticsEndpoint:
    """Verify diagnostics endpoint runs all 7 probes."""

    @pytest.mark.asyncio
    async def test_diagnostics_returns_7_probes(self):
        """Diagnostics should return 7 system probes."""
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{BASE}/api/diagnostics")
            assert r.status_code == 200
            data = r.json()
            assert data["summary"]["total"] == 7
            probe_names = [p["name"] for p in data["probes"]]
            expected = ["db_ping", "db_crud_cycle", "db_indexes", "ai_gateway", "nhtsa_api", "filesystem", "memory"]
            assert probe_names == expected

    @pytest.mark.asyncio
    async def test_diagnostics_db_probes_pass(self):
        """DB probes (ping, crud, indexes) should pass."""
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{BASE}/api/diagnostics")
            data = r.json()
            db_probes = [p for p in data["probes"] if p["name"].startswith("db_")]
            for probe in db_probes:
                assert probe["status"] == "pass", f"{probe['name']} failed: {probe.get('error')}"

    @pytest.mark.asyncio
    async def test_diagnostics_ai_gateway_probe(self):
        """AI Gateway probe should pass with key configured."""
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{BASE}/api/diagnostics")
            data = r.json()
            ai_probe = next(p for p in data["probes"] if p["name"] == "ai_gateway")
            assert ai_probe["status"] == "pass"
            assert ai_probe["key_configured"] is True

    @pytest.mark.asyncio
    async def test_diagnostics_filesystem_probe(self):
        """Filesystem probe should pass (uploads dir writable)."""
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{BASE}/api/diagnostics")
            data = r.json()
            fs_probe = next(p for p in data["probes"] if p["name"] == "filesystem")
            assert fs_probe["status"] == "pass"

    @pytest.mark.asyncio
    async def test_diagnostics_memory_probe(self):
        """Memory probe should pass (RSS under threshold)."""
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{BASE}/api/diagnostics")
            data = r.json()
            mem_probe = next(p for p in data["probes"] if p["name"] == "memory")
            assert mem_probe["status"] in ("pass", "warn")  # warn is acceptable


class TestPydanticResponseModels:
    """Verify endpoints return data matching Pydantic response models."""

    @pytest.mark.asyncio
    async def test_health_response_model(self):
        """HealthResponse: status, timestamp, version, scheduler, dataSources."""
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/health")
            data = r.json()
            assert "status" in data
            assert "timestamp" in data
            assert "version" in data
            assert "scheduler" in data
            assert "dataSources" in data

    @pytest.mark.asyncio
    async def test_ready_response_model(self):
        """ReadyResponse: ready bool."""
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/ready")
            data = r.json()
            assert "ready" in data
            assert isinstance(data["ready"], bool)

    @pytest.mark.asyncio
    async def test_root_response_model(self):
        """RootResponse: message, version."""
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/")
            data = r.json()
            assert "message" in data
            assert "version" in data

    @pytest.mark.asyncio
    async def test_metrics_response_model(self):
        """MetricsResponse: uptime_seconds, process, database, ai_gateway."""
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/metrics")
            data = r.json()
            assert "uptime_seconds" in data
            assert "process" in data
            assert "memory_rss_mb" in data["process"]
            assert "memory_vms_mb" in data["process"]
            assert "cpu_percent" in data["process"]
            assert "threads" in data["process"]
            assert "database" in data
            assert "size_mb" in data["database"]
            assert "collections" in data["database"]
            assert "ai_gateway" in data

    @pytest.mark.asyncio
    async def test_diagnostics_response_model(self):
        """DiagnosticsResponse: status, total_ms, summary, probes."""
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{BASE}/api/diagnostics")
            data = r.json()
            assert "status" in data
            assert data["status"] in ("pass", "warn", "fail")
            assert "total_ms" in data
            assert "summary" in data
            assert "passed" in data["summary"]
            assert "warned" in data["summary"]
            assert "failed" in data["summary"]
            assert "total" in data["summary"]
            assert "probes" in data
            for probe in data["probes"]:
                assert "name" in probe
                assert "status" in probe


class TestRateLimiterExemptions:
    """Verify rate limiter exempts certain paths and loopback IPs."""

    @pytest.mark.asyncio
    async def test_health_exempt_from_rate_limit(self):
        """Health endpoint should be exempt from rate limiting."""
        async with httpx.AsyncClient() as client:
            # Make multiple rapid requests
            for _ in range(10):
                r = await client.get(f"{BASE}/api/health")
                assert r.status_code == 200  # Should not get 429

    @pytest.mark.asyncio
    async def test_ready_exempt_from_rate_limit(self):
        """Ready endpoint should be exempt from rate limiting."""
        async with httpx.AsyncClient() as client:
            for _ in range(10):
                r = await client.get(f"{BASE}/api/ready")
                assert r.status_code == 200  # Should not get 429

    @pytest.mark.asyncio
    async def test_diagnostics_exempt_from_rate_limit(self):
        """Diagnostics endpoint should be exempt from rate limiting."""
        async with httpx.AsyncClient(timeout=30) as client:
            for _ in range(3):  # Fewer requests since diagnostics is heavier
                r = await client.get(f"{BASE}/api/diagnostics")
                assert r.status_code == 200


class TestBackendFileReorganization:
    """Verify services directory structure and imports work."""

    def test_services_directory_exists(self):
        """services/ directory should exist with service files."""
        import os
        services_path = "/app/backend/services"
        assert os.path.isdir(services_path)
        files = os.listdir(services_path)
        expected_files = [
            "ai_gateway.py",
            "telemetry_service.py",
            "conversation_history.py",
            "vector_search.py",
        ]
        for f in expected_files:
            assert f in files, f"Expected {f} in services/"

    def test_services_init_exists(self):
        """services/__init__.py should exist for proper imports."""
        import os
        init_path = "/app/backend/services/__init__.py"
        assert os.path.isfile(init_path)


class TestRegressionEndpoints:
    """Ensure existing functionality still works."""

    @pytest.mark.asyncio
    async def test_customers_list(self):
        """GET /api/customers?limit=5 should still work."""
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/customers?limit=5")
            assert r.status_code == 200
            data = r.json()
            assert "customers" in data
            assert "count" in data

    @pytest.mark.asyncio
    async def test_vin_decode(self):
        """GET /api/vin/decode/{vin} should still work."""
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/vin/decode/1HGCM82633A004352")
            assert r.status_code == 200
            data = r.json()
            assert data["vin"] == "1HGCM82633A004352"
            assert data["make"] == "HONDA"

    @pytest.mark.asyncio
    async def test_auth_status(self):
        """GET /api/auth/status should still work."""
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/auth/status")
            assert r.status_code == 200
            data = r.json()
            assert "pin_set" in data

    @pytest.mark.asyncio
    async def test_vin_batch_decode(self):
        """POST /api/vin/decode-batch should still work."""
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{BASE}/api/vin/decode-batch",
                json={"vins": ["1HGCM82633A004352"]}
            )
            assert r.status_code == 200
            data = r.json()
            assert "results" in data
            assert "total" in data
            assert data["total"] == 1


class TestFastAPIVersion:
    """Verify FastAPI version is correct."""

    def test_fastapi_version_0_135_1(self):
        """FastAPI should be version 0.135.1."""
        import fastapi
        assert fastapi.__version__ == "0.135.1"


class TestEnvironmentValidation:
    """Test that env validation is working (server wouldn't start without it).
    
    Note: The server itself validates MONGO_URL and DB_NAME at startup via
    server.py lines 62-64. If these weren't set, the server wouldn't start.
    Since API calls work, we know the env validation passed at server startup.
    """

    @pytest.mark.asyncio
    async def test_server_started_means_env_validated(self):
        """Server is running means MONGO_URL and DB_NAME are set.
        
        server.py raises RuntimeError if MONGO_URL or DB_NAME is missing.
        If we can call /api/health, the server started, so env is valid.
        """
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/health")
            assert r.status_code == 200, "Server running proves env validation passed"

    def test_env_validation_code_exists(self):
        """Verify env validation code exists in server.py."""
        with open("/app/backend/server.py", "r") as f:
            content = f.read()
        assert "_REQUIRED_ENV = ['MONGO_URL', 'DB_NAME']" in content
        assert "RuntimeError" in content
        assert "Required environment variable" in content
