"""Tests for deployment hardening features (v2.1.0).

Tests the new readiness probe, metrics endpoint, security headers,
and verifies existing endpoints still work with ORJSONResponse.
"""
import pytest
import httpx

BASE = "http://localhost:8001"


class TestReadinessProbe:
    """Tests for the /api/ready endpoint."""

    @pytest.mark.asyncio
    async def test_ready_returns_200(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/ready")
            assert r.status_code == 200
            data = r.json()
            assert data["ready"] is True


class TestMetricsEndpoint:
    """Tests for the /api/metrics endpoint."""

    @pytest.mark.asyncio
    async def test_metrics_returns_process_info(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/metrics")
            assert r.status_code == 200
            data = r.json()
            assert "uptime_seconds" in data
            assert data["uptime_seconds"] > 0
            assert "process" in data
            assert data["process"]["memory_rss_mb"] > 0
            assert data["process"]["threads"] > 0
            assert "database" in data
            assert "ai_gateway" in data


class TestSecurityHeaders:
    """Verify all security headers are present."""

    @pytest.mark.asyncio
    async def test_security_headers_on_api(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/health")
            h = r.headers
            assert "strict-transport-security" in h
            assert "preload" in h["strict-transport-security"]
            assert h["x-frame-options"] == "DENY"
            assert h["x-content-type-options"] == "nosniff"
            assert h["x-xss-protection"] == "1; mode=block"
            assert h["referrer-policy"] == "strict-origin-when-cross-origin"
            assert "default-src 'self'" in h["content-security-policy"]
            assert "geolocation=()" in h["permissions-policy"]

    @pytest.mark.asyncio
    async def test_cache_control_on_api(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/health")
            assert "no-store" in r.headers.get("cache-control", "")
            assert r.headers.get("pragma") == "no-cache"

    @pytest.mark.asyncio
    async def test_correlation_id_and_response_time(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/health")
            assert "x-correlation-id" in r.headers
            assert "x-response-time" in r.headers
            assert r.headers["x-response-time"].endswith("ms")


class TestVersionBump:
    """Verify version was updated."""

    @pytest.mark.asyncio
    async def test_version_in_health(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/health")
            data = r.json()
            assert data["version"] == "2.1.0"

    @pytest.mark.asyncio
    async def test_version_in_root(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/")
            data = r.json()
            assert data["version"] == "2.1.0"


class TestORJSONSerialization:
    """Verify ORJSONResponse is working correctly."""

    @pytest.mark.asyncio
    async def test_json_content_type(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/health")
            assert "application/json" in r.headers.get("content-type", "")

    @pytest.mark.asyncio
    async def test_customers_with_orjson(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/customers?limit=2")
            assert r.status_code == 200
            data = r.json()
            assert "customers" in data
            assert "count" in data


class TestExistingEndpointRegression:
    """Ensure existing endpoints still work after optimizations."""

    @pytest.mark.asyncio
    async def test_auth_status(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/auth/status")
            assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_vin_trade_in_count(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/vin/trade-in-count")
            assert r.status_code == 200
            data = r.json()
            assert "count" in data
            assert "cap" in data

    @pytest.mark.asyncio
    async def test_customers_stats(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/customers/stats")
            assert r.status_code == 200

    @pytest.mark.asyncio
    async def test_ai_gateway_stats(self):
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{BASE}/api/ai/stats")
            assert r.status_code == 200
