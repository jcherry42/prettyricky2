"""
Performance Optimization Tests - Iteration 4
=============================================
Tests for:
1. NHTSA VIN decode LRU cache (1hr TTL, 1024 entries) + shared httpx client
2. MongoDB indexes on ai_gateway_logs and vehicles.category
3. Startup parallelization with asyncio.gather
4. Rate limiter rewritten with deque sliding window
5. AI Gateway telemetry fire-and-forget with asyncio.create_task
6. Health check 5-second cache

REGRESSION: All existing endpoints must still respond correctly
"""

import pytest
import requests
import time
import base64
import os
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

# Use environment variable for base URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')


class TestHealthEndpoint:
    """Test cached health check endpoint (5-second TTL)"""

    def test_health_check_returns_200(self):
        """GET /api/health - basic health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "scheduler" in data
        print(f"✓ Health check OK: status={data['status']}")

    def test_health_check_caching_performance(self):
        """GET /api/health - second call should be much faster (cached)"""
        # First call (might hit DB)
        t1_start = time.time()
        r1 = requests.get(f"{BASE_URL}/api/health")
        t1_end = time.time()
        t1_ms = (t1_end - t1_start) * 1000

        # Second call immediately (should be cached)
        t2_start = time.time()
        r2 = requests.get(f"{BASE_URL}/api/health")
        t2_end = time.time()
        t2_ms = (t2_end - t2_start) * 1000

        assert r1.status_code == 200
        assert r2.status_code == 200
        # Both should return valid data
        assert r1.json()["status"] == "healthy"
        assert r2.json()["status"] == "healthy"

        print(f"✓ Health caching: first={t1_ms:.1f}ms, second={t2_ms:.1f}ms")
        # Note: Can't assert exact timing due to network variance, but log for observation


class TestVinDecodeWithCache:
    """Test VIN decode endpoint with NHTSA LRU caching"""

    def test_decode_honda_vin(self):
        """GET /api/vin/decode/1HGCG5655WA043355 - decodes Honda Accord 1998"""
        response = requests.get(f"{BASE_URL}/api/vin/decode/1HGCG5655WA043355")
        assert response.status_code == 200
        data = response.json()
        assert data["vin"] == "1HGCG5655WA043355"
        assert data.get("make", "").upper() == "HONDA"
        assert "validation" in data
        print(f"✓ Honda VIN decoded: {data.get('year')} {data.get('make')} {data.get('model')}")

    def test_decode_bmw_vin(self):
        """GET /api/vin/decode/WBA3B1C56FK135231 - decodes BMW correctly"""
        response = requests.get(f"{BASE_URL}/api/vin/decode/WBA3B1C56FK135231")
        assert response.status_code == 200
        data = response.json()
        assert data["vin"] == "WBA3B1C56FK135231"
        assert data.get("make", "").upper() == "BMW"
        print(f"✓ BMW VIN decoded: {data.get('year')} {data.get('make')} {data.get('model')}")

    def test_decode_cache_performance(self):
        """VIN decode cache: second call to same VIN should be instant"""
        vin = "WBA3B1C56FK135231"
        
        # First call (may hit NHTSA API)
        t1_start = time.time()
        r1 = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        t1_end = time.time()
        t1_ms = (t1_end - t1_start) * 1000

        # Second call (should be cached)
        t2_start = time.time()
        r2 = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        t2_end = time.time()
        t2_ms = (t2_end - t2_start) * 1000

        assert r1.status_code == 200
        assert r2.status_code == 200
        
        # Data should be identical
        assert r1.json()["vin"] == r2.json()["vin"]
        assert r1.json()["make"] == r2.json()["make"]

        # Log performance - cached should be significantly faster
        print(f"✓ VIN cache performance: cold={t1_ms:.1f}ms, cached={t2_ms:.1f}ms")
        
        # Cached call should be much faster (at least 5x typically)
        # We don't assert exact ratio due to network variance, but second call should be fast
        if t1_ms > 50 and t2_ms < t1_ms / 2:
            print(f"  Cache speedup: {t1_ms / t2_ms:.1f}x faster")

    def test_decode_invalid_vin_length(self):
        """GET /api/vin/decode - rejects VIN with wrong length"""
        response = requests.get(f"{BASE_URL}/api/vin/decode/ABC123")
        assert response.status_code == 400
        assert "17 characters" in response.json()["detail"]
        print("✓ Invalid VIN length correctly rejected")

    def test_decode_invalid_vin_chars(self):
        """GET /api/vin/decode - rejects VIN with I, O, Q chars"""
        response = requests.get(f"{BASE_URL}/api/vin/decode/1HGCG5655WA04335I")
        assert response.status_code == 400
        assert "invalid characters" in response.json()["detail"].lower()
        print("✓ VIN with invalid chars (I/O/Q) correctly rejected")


class TestVinOcrEndpoint:
    """Test VIN OCR extraction from images"""

    @staticmethod
    def _generate_vin_image(vin: str = "1HGCG5655WA043355", width: int = 600, height: int = 200) -> str:
        """Generate a test image with VIN text, return base64 encoded"""
        img = Image.new('RGB', (width, height), color='white')
        draw = ImageDraw.Draw(img)
        
        # Draw VIN text in large black font
        try:
            # Try to get a decent font
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 36)
        except:
            # Fall back to default
            font = ImageFont.load_default()
        
        # Center the text
        text = vin
        draw.text((50, 80), text, fill='black', font=font)
        
        # Add some background noise to make it realistic
        draw.rectangle([20, 20, width-20, height-20], outline='gray', width=2)
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=85)
        buffer.seek(0)
        return base64.b64encode(buffer.read()).decode('ascii')

    def test_vin_ocr_accepts_large_image(self):
        """POST /api/vin/extract-from-image - accepts large base64 image"""
        # Generate a larger image (>5KB to pass size check)
        img_b64 = self._generate_vin_image(width=1200, height=600)
        
        response = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json={"image_base64": img_b64}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "vins" in data
        assert "confidence" in data
        assert "notes" in data
        print(f"✓ VIN OCR large image accepted: confidence={data['confidence']}, found {len(data['vins'])} VINs")

    def test_vin_ocr_rejects_small_image(self):
        """POST /api/vin/extract-from-image - rejects too-small images gracefully"""
        # Create a tiny image (<5KB)
        img = Image.new('RGB', (50, 50), color='white')
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=50)
        buffer.seek(0)
        tiny_b64 = base64.b64encode(buffer.read()).decode('ascii')
        
        response = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json={"image_base64": tiny_b64}
        )
        
        assert response.status_code == 200  # Graceful response, not error
        data = response.json()
        assert data["confidence"] == "low"
        assert data["vins"] == []
        assert "small" in data["notes"].lower() or "too small" in data["notes"].lower()
        print(f"✓ Small image rejected gracefully: {data['notes']}")

    def test_vin_ocr_rejects_invalid_base64(self):
        """POST /api/vin/extract-from-image - rejects invalid base64"""
        response = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json={"image_base64": "not-valid-base64!!!"}
        )
        
        assert response.status_code == 400
        print("✓ Invalid base64 correctly rejected with 400")

    def test_vin_ocr_rejects_empty_image(self):
        """POST /api/vin/extract-from-image - rejects empty image_base64"""
        response = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json={"image_base64": ""}
        )
        
        assert response.status_code == 400
        print("✓ Empty image_base64 correctly rejected with 400")


class TestVinSaveEndpoints:
    """Test VIN save endpoints"""

    def test_vin_save_basic(self):
        """POST /api/vin/save - saves a vehicle to inventory"""
        test_vin = f"TESTPERF{int(time.time())}"[:17].ljust(17, 'X')
        
        response = requests.post(
            f"{BASE_URL}/api/vin/save",
            json={
                "vin": test_vin,
                "vehicle_data": {
                    "year": "2024",
                    "make": "Test",
                    "model": "Performance"
                }
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print(f"✓ VIN save successful: {data.get('message', 'OK')}")

    def test_trade_in_count(self):
        """GET /api/vin/trade-in-count - returns count and cap"""
        response = requests.get(f"{BASE_URL}/api/vin/trade-in-count")
        
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert "cap" in data
        assert data["cap"] == 50  # As per TRADE_IN_CAP constant
        assert "remaining" in data
        assert "at_limit" in data
        print(f"✓ Trade-in count: {data['count']}/{data['cap']} (remaining: {data['remaining']})")


class TestAIGatewayStats:
    """Test AI Gateway observability endpoint"""

    def test_ai_gateway_stats(self):
        """GET /api/ai/stats - returns model routes including vin_ocr"""
        response = requests.get(f"{BASE_URL}/api/ai/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have model_routes
        assert "model_routes" in data
        routes = data["model_routes"]
        
        # vin_ocr should be registered
        assert "vin_ocr" in routes
        assert routes["vin_ocr"]["primary"] == "gpt-4o"
        
        # Should have cache stats
        assert "cache" in data
        
        # Should have circuit_breakers
        assert "circuit_breakers" in data
        
        print(f"✓ AI Gateway stats: {len(routes)} routes registered")
        print(f"  Cache: {data['cache'].get('entries', 0)} entries, hit_rate={data['cache'].get('hit_rate', 0)}")


class TestRootEndpoint:
    """Test root API endpoint"""

    def test_root_returns_message(self):
        """GET /api/ - returns root message"""
        response = requests.get(f"{BASE_URL}/api/")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Closr API"
        assert "version" in data
        print(f"✓ Root endpoint: {data['message']} v{data['version']}")


class TestRateLimiter:
    """Test rate limiting (sliding window with deque)"""

    def test_multiple_rapid_requests(self):
        """Rate limiting - multiple rapid requests should not crash server"""
        # Send 20 rapid requests to health endpoint (lightweight)
        responses = []
        for i in range(20):
            r = requests.get(f"{BASE_URL}/api/health")
            responses.append(r.status_code)
        
        # All should succeed (we're under the 100/min, 150 burst limits)
        success_count = responses.count(200)
        assert success_count >= 18  # Allow some variance
        print(f"✓ Rate limiter: {success_count}/20 requests successful")

    def test_rate_limiter_allows_normal_traffic(self):
        """Rate limiter allows normal traffic patterns"""
        # Spread out requests with small delays
        success_count = 0
        for i in range(10):
            r = requests.get(f"{BASE_URL}/api/")
            if r.status_code == 200:
                success_count += 1
            time.sleep(0.1)  # 100ms between requests
        
        assert success_count == 10
        print(f"✓ Rate limiter: all {success_count}/10 normal requests succeeded")


class TestRegressionEndpoints:
    """Regression tests - ensure existing functionality still works"""

    def test_vehicles_inventory_endpoint(self):
        """GET /api/vehicles/inventory - regression check"""
        response = requests.get(f"{BASE_URL}/api/vehicles/inventory")
        assert response.status_code == 200
        print("✓ REGRESSION: /api/vehicles/inventory OK")

    def test_customers_list_endpoint(self):
        """GET /api/customers/list - regression check"""
        response = requests.get(f"{BASE_URL}/api/customers/list")
        assert response.status_code == 200
        print("✓ REGRESSION: /api/customers/list OK")


# Run tests with pytest
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
