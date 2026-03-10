"""
VIN OCR Extraction Tests - Iteration 3
=======================================
Tests for the new POST /api/vin/extract-from-image endpoint.

Features tested:
- VIN extraction from windshield plate image (AI Vision OCR)
- Small image rejection (<5KB graceful handling)
- Invalid/empty base64 handling
- Regression tests for existing VIN endpoints
"""

import pytest
import requests
import base64
import io
import os
from PIL import Image, ImageDraw, ImageFont

# Use public URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')


# ========================= HELPERS =========================

def create_test_image_with_vin(vin_text: str = "1HGBH41JXMN109186", width: int = 800, height: int = 200) -> bytes:
    """Create a test image with VIN text drawn on it."""
    img = Image.new('RGB', (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Try to use a font that looks like VIN plates
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 48)
    except:
        font = ImageFont.load_default()
    
    # Center the text
    bbox = draw.textbbox((0, 0), vin_text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    
    draw.text((x, y), vin_text, fill=(0, 0, 0), font=font)
    
    # Save as JPEG
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=95)
    return buf.getvalue()


def create_small_image() -> bytes:
    """Create a tiny image that's <5KB to test rejection."""
    img = Image.new('RGB', (10, 10), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=10)
    return buf.getvalue()


def create_large_valid_image(vin_text: str = "1HGBH41JXMN109186") -> bytes:
    """Create a larger image (>5KB) with VIN text."""
    return create_test_image_with_vin(vin_text, width=1200, height=400)


# ========================= HEALTH & REGRESSION TESTS =========================

class TestHealthAndRegression:
    """Verify health and existing endpoints still work."""

    def test_health_check(self):
        """GET /api/health - should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy"
        print("PASS: Health check returns healthy status")

    def test_vin_decode_valid(self):
        """GET /api/vin/decode/{vin} - should decode valid VIN (regression)"""
        test_vin = "1HGCM82633A004352"  # Valid Honda Accord VIN
        response = requests.get(f"{BASE_URL}/api/vin/decode/{test_vin}", timeout=15)
        assert response.status_code == 200, f"VIN decode failed: {response.text}"
        data = response.json()
        assert data.get("vin") == test_vin
        assert data.get("make") == "HONDA"
        assert data.get("model") == "Accord"
        assert data.get("year") == "2003"
        print(f"PASS: VIN decode works for {test_vin} -> {data.get('year')} {data.get('make')} {data.get('model')}")

    def test_vin_decode_invalid_length(self):
        """GET /api/vin/decode/{vin} - should reject VIN with wrong length"""
        invalid_vin = "ABC123"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{invalid_vin}", timeout=10)
        assert response.status_code == 400, f"Expected 400 for invalid VIN length, got {response.status_code}"
        print("PASS: VIN decode rejects invalid length VIN")

    def test_vin_decode_invalid_chars(self):
        """GET /api/vin/decode/{vin} - should reject VIN with I, O, Q"""
        invalid_vin = "1HGCM82633A00435I"  # Contains 'I'
        response = requests.get(f"{BASE_URL}/api/vin/decode/{invalid_vin}", timeout=10)
        assert response.status_code == 400, f"Expected 400 for VIN with invalid chars, got {response.status_code}"
        print("PASS: VIN decode rejects VIN with invalid characters (I, O, Q)")

    def test_trade_in_count(self):
        """GET /api/vin/trade-in-count - should return count and cap (regression)"""
        response = requests.get(f"{BASE_URL}/api/vin/trade-in-count", timeout=10)
        assert response.status_code == 200, f"Trade-in count failed: {response.text}"
        data = response.json()
        assert "count" in data
        assert "cap" in data
        assert data.get("cap") == 50
        assert "remaining" in data
        assert "at_limit" in data
        print(f"PASS: Trade-in count returns count={data['count']}, cap={data['cap']}")

    def test_vin_save(self):
        """POST /api/vin/save - should accept vehicle data (regression)"""
        test_data = {
            "vin": "TEST_SAVE_VIN_000",
            "vehicle_data": {
                "year": "2024",
                "make": "TESTMAKE",
                "model": "TestModel",
            }
        }
        response = requests.post(f"{BASE_URL}/api/vin/save", json=test_data, timeout=10)
        assert response.status_code == 200, f"VIN save failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"PASS: VIN save works - {data.get('message')}")


# ========================= VIN OCR EXTRACTION TESTS =========================

class TestVinOcrExtract:
    """Tests for POST /api/vin/extract-from-image endpoint."""

    def test_extract_with_valid_image(self):
        """POST /api/vin/extract-from-image - should extract VIN from valid image."""
        # Create a test image with known VIN text
        vin_text = "1HGBH41JXMN109186"  # Valid Honda VIN
        image_bytes = create_large_valid_image(vin_text)
        image_b64 = base64.b64encode(image_bytes).decode('ascii')
        
        assert len(image_bytes) >= 5 * 1024, f"Test image too small: {len(image_bytes)} bytes"
        
        payload = {
            "image_base64": image_b64
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json=payload,
            timeout=60  # AI calls can take time
        )
        
        assert response.status_code == 200, f"VIN OCR extract failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "vins" in data, "Response missing 'vins' field"
        assert "confidence" in data, "Response missing 'confidence' field"
        assert "notes" in data, "Response missing 'notes' field"
        
        assert data["confidence"] in ["high", "medium", "low"], f"Invalid confidence: {data['confidence']}"
        
        print(f"PASS: VIN OCR extract returned vins={data['vins']}, confidence={data['confidence']}")
        print(f"      Notes: {data['notes']}")

    def test_extract_with_small_image(self):
        """POST /api/vin/extract-from-image - should gracefully handle small images (<5KB)."""
        small_image = create_small_image()
        image_b64 = base64.b64encode(small_image).decode('ascii')
        
        assert len(small_image) < 5 * 1024, f"Image should be <5KB for this test: {len(small_image)} bytes"
        
        payload = {
            "image_base64": image_b64
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json=payload,
            timeout=30
        )
        
        # Should return 200 with low confidence, not an error
        assert response.status_code == 200, f"Expected 200 for small image, got {response.status_code}"
        data = response.json()
        
        assert data.get("vins") == [], f"Expected empty vins for small image, got {data.get('vins')}"
        assert data.get("confidence") == "low", f"Expected low confidence for small image, got {data.get('confidence')}"
        assert "too small" in data.get("notes", "").lower(), f"Expected 'too small' in notes: {data.get('notes')}"
        
        print(f"PASS: Small image handling works - confidence={data['confidence']}, notes='{data['notes']}'")

    def test_extract_with_empty_base64(self):
        """POST /api/vin/extract-from-image - should reject empty base64."""
        payload = {
            "image_base64": ""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json=payload,
            timeout=10
        )
        
        assert response.status_code == 400, f"Expected 400 for empty base64, got {response.status_code}"
        print(f"PASS: Empty base64 rejected with 400")

    def test_extract_with_invalid_base64(self):
        """POST /api/vin/extract-from-image - should reject invalid base64 data."""
        payload = {
            "image_base64": "not-valid-base64!@#$%"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json=payload,
            timeout=10
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid base64, got {response.status_code}"
        data = response.json()
        assert "invalid" in data.get("detail", "").lower() or "base64" in data.get("detail", "").lower()
        print(f"PASS: Invalid base64 rejected with 400 - {data.get('detail')}")

    def test_extract_with_ml_text_hint(self):
        """POST /api/vin/extract-from-image - should accept optional ml_text_hint."""
        vin_text = "1HGCM82633A004352"
        image_bytes = create_large_valid_image(vin_text)
        image_b64 = base64.b64encode(image_bytes).decode('ascii')
        
        payload = {
            "image_base64": image_b64,
            "ml_text_hint": f"Possible VIN detected: {vin_text}"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json=payload,
            timeout=60
        )
        
        assert response.status_code == 200, f"VIN OCR with hint failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert "vins" in data
        assert "confidence" in data
        
        print(f"PASS: VIN OCR with ml_text_hint works - vins={data['vins']}, confidence={data['confidence']}")

    def test_extract_response_structure(self):
        """POST /api/vin/extract-from-image - verify response matches VinOcrResponse model."""
        vin_text = "5YJSA1DN5CFP01234"  # Valid Tesla VIN format
        image_bytes = create_large_valid_image(vin_text)
        image_b64 = base64.b64encode(image_bytes).decode('ascii')
        
        payload = {
            "image_base64": image_b64
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json=payload,
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required fields
        assert isinstance(data.get("vins"), list), "vins must be a list"
        assert isinstance(data.get("confidence"), str), "confidence must be a string"
        assert isinstance(data.get("notes"), str), "notes must be a string"
        
        # raw_candidates is optional
        if "raw_candidates" in data:
            assert data["raw_candidates"] is None or isinstance(data["raw_candidates"], list)
        
        print(f"PASS: Response structure matches VinOcrResponse model")


# ========================= VIN SAVE ENDPOINT TEST =========================

class TestVinSaveToInventory:
    """Test POST /api/vin/save-to-inventory endpoint (regression)."""

    def test_save_to_active_inventory(self):
        """POST /api/vin/save-to-inventory - save as active inventory."""
        import uuid
        unique_vin = f"TEST{uuid.uuid4().hex[:12].upper()}"[:17]  # Generate unique 17-char VIN
        
        payload = {
            "vin": unique_vin,
            "vehicle_data": {
                "year": "2024",
                "make": "TESTMAKE",
                "model": "TestModel"
            },
            "category": "active_inventory"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vin/save-to-inventory",
            json=payload,
            timeout=10
        )
        
        # May fail with 409 if VIN already exists - that's OK for this test
        assert response.status_code in [200, 409], f"Unexpected status: {response.status_code} - {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert data.get("category") == "active_inventory"
            print(f"PASS: Save to active_inventory works - id={data.get('id')}")
        else:
            print(f"PASS: Save-to-inventory returns 409 for duplicate VIN (expected behavior)")


# ========================= PYTEST RUNNER =========================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
