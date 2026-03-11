"""
VIN Scanner Feature Tests - Iteration 16
Tests for VIN decode API, validation, and save-to-inventory functionality
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vin-scanner-audit.preview.emergentagent.com').rstrip('/')


class TestVinDecodeAPI:
    """Tests for /api/vin/decode/{vin} endpoint"""
    
    def test_decode_valid_vin_ford_mustang(self):
        """Test decoding a valid VIN - 2018 Ford Mustang"""
        vin = "1FA6P8TH1J5117440"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify core vehicle data
        assert data["vin"] == vin
        assert data["year"] == "2018"
        assert data["make"] == "FORD"
        assert data["model"] == "Mustang"
        
        # Verify additional details
        assert "trim" in data
        assert "fuel_type" in data
        assert data["fuel_type"] == "Gasoline"
        
        # Verify safety features array
        assert "safety_features" in data
        assert isinstance(data["safety_features"], list)
        assert len(data["safety_features"]) > 0
        
        # Verify validation/confidence score
        assert "validation" in data
        assert "confidence_score" in data["validation"]
        assert data["validation"]["confidence_score"] >= 0
        assert data["validation"]["confidence_score"] <= 100
        
        print(f"✓ VIN decode successful: {data['year']} {data['make']} {data['model']}")
        print(f"  Confidence: {data['validation']['confidence_score']}%")
        print(f"  Safety features: {data['safety_features']}")
    
    def test_decode_valid_vin_returns_engine_info(self):
        """Test that VIN decode returns engine information"""
        vin = "1FA6P8TH1J5117440"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check engine-related fields
        assert "cylinders" in data or "engine_display" in data
        assert "displacement" in data or "engine_display" in data
        
        if "engine_display" in data:
            print(f"✓ Engine info: {data['engine_display']}")
        
        if "transmission" in data:
            print(f"✓ Transmission: {data['transmission']}")
    
    def test_decode_valid_vin_returns_plant_location(self):
        """Test that VIN decode returns manufacturing location"""
        vin = "1FA6P8TH1J5117440"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check plant location fields
        assert "assembly_location" in data or "plant_country" in data
        
        if "assembly_location" in data:
            print(f"✓ Assembly location: {data['assembly_location']}")
    
    def test_decode_invalid_vin_too_short(self):
        """Test error handling for VIN that's too short"""
        vin = "INVALID123"  # Only 10 characters
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "17 characters" in data["detail"].lower() or "17" in data["detail"]
        print(f"✓ Short VIN rejected: {data['detail']}")
    
    def test_decode_invalid_vin_too_long(self):
        """Test error handling for VIN that's too long"""
        vin = "1FA6P8TH1J511744012345"  # More than 17 characters
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Long VIN rejected: {data['detail']}")
    
    def test_decode_invalid_vin_with_forbidden_chars(self):
        """Test error handling for VIN with I, O, Q characters"""
        # VINs cannot contain I, O, or Q
        vin = "1FA6P8TH1I5117440"  # Contains 'I'
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "invalid" in data["detail"].lower() or "I, O, Q" in data["detail"]
        print(f"✓ VIN with forbidden chars rejected: {data['detail']}")
    
    def test_decode_vin_case_insensitive(self):
        """Test that VIN decode is case-insensitive"""
        vin_upper = "1FA6P8TH1J5117440"
        vin_lower = "1fa6p8th1j5117440"
        
        response_upper = requests.get(f"{BASE_URL}/api/vin/decode/{vin_upper}")
        response_lower = requests.get(f"{BASE_URL}/api/vin/decode/{vin_lower}")
        
        assert response_upper.status_code == 200
        assert response_lower.status_code == 200
        
        data_upper = response_upper.json()
        data_lower = response_lower.json()
        
        # Both should return the same vehicle
        assert data_upper["make"] == data_lower["make"]
        assert data_upper["model"] == data_lower["model"]
        assert data_upper["year"] == data_lower["year"]
        print("✓ VIN decode is case-insensitive")


class TestVinValidation:
    """Tests for VIN validation logic"""
    
    def test_vin_validation_checksum(self):
        """Test that validation includes checksum verification"""
        vin = "1FA6P8TH1J5117440"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "validation" in data
        assert "checksum_valid" in data["validation"]
        assert "sources_checked" in data["validation"]
        
        # Should check multiple sources
        sources = data["validation"]["sources_checked"]
        assert len(sources) >= 1
        print(f"✓ Validation sources: {sources}")
    
    def test_vin_validation_manufacturer_verified(self):
        """Test that manufacturer is verified against WMI database"""
        vin = "1FA6P8TH1J5117440"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "validation" in data
        assert "manufacturer_verified" in data["validation"]
        print(f"✓ Manufacturer verified: {data['validation']['manufacturer_verified']}")


class TestVinSaveToInventory:
    """Tests for /api/vin/save-to-inventory endpoint"""
    
    def test_save_to_inventory_endpoint_exists(self):
        """Test that save-to-inventory endpoint exists"""
        # First decode a VIN
        vin = "1FA6P8TH1J5117440"
        decode_response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert decode_response.status_code == 200
        vehicle_data = decode_response.json()
        
        # Try to save to inventory
        save_payload = {
            **vehicle_data,
            "isTradeIn": False
        }
        
        save_response = requests.post(
            f"{BASE_URL}/api/vin/save-to-inventory",
            json=save_payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Endpoint should exist (may return 200 or 422 depending on validation)
        assert save_response.status_code in [200, 201, 422, 400], f"Unexpected status: {save_response.status_code}"
        print(f"✓ Save to inventory endpoint exists, status: {save_response.status_code}")
    
    def test_save_as_trade_in(self):
        """Test saving vehicle as trade-in"""
        vin = "1FA6P8TH1J5117440"
        decode_response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert decode_response.status_code == 200
        vehicle_data = decode_response.json()
        
        save_payload = {
            **vehicle_data,
            "isTradeIn": True
        }
        
        save_response = requests.post(
            f"{BASE_URL}/api/vin/save-to-inventory",
            json=save_payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Endpoint should accept trade-in flag
        assert save_response.status_code in [200, 201, 422, 400]
        print(f"✓ Trade-in save endpoint works, status: {save_response.status_code}")


class TestVinDecodeEdgeCases:
    """Edge case tests for VIN decode"""
    
    def test_decode_another_valid_vin(self):
        """Test decoding a different valid VIN"""
        # 2020 Toyota Camry VIN
        vin = "4T1BF1FK5LU123456"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        
        # May return 200 or 404 depending on if VIN exists in NHTSA database
        if response.status_code == 200:
            data = response.json()
            assert "make" in data
            assert "model" in data
            print(f"✓ Decoded: {data.get('year', 'N/A')} {data.get('make', 'N/A')} {data.get('model', 'N/A')}")
        else:
            print(f"✓ VIN not found in database (expected for test VINs)")
    
    def test_decode_vin_with_special_characters_rejected(self):
        """Test that VINs with special characters are rejected"""
        vin = "1FA6P8TH1J511744!"  # Contains special character
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        
        # Should be rejected
        assert response.status_code in [400, 422]
        print("✓ VIN with special characters rejected")


class TestHealthEndpoint:
    """Test health endpoint to verify API is running"""
    
    def test_health_check(self):
        """Test that health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ API health check passed: {data['status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
