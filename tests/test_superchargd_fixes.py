"""
Supercharg'd - Test Suite for 7 Major Fixes
Tests: VIN Scanner, Translation API, Tower Talk, Quick Add Customer
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pwa-native-preview.preview.emergentagent.com')

class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✅ API Health: {data['status']}")


class TestVINScanner:
    """VIN Scanner - manual entry and decode tests"""
    
    def test_vin_decode_valid(self):
        """Test VIN decode with valid VIN"""
        vin = "1HGCM82633A123456"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify vehicle details
        assert data["vin"] == vin
        assert data["year"] == "2003"
        assert data["make"] == "HONDA"
        assert data["model"] == "Accord"
        assert "validation" in data
        assert "confidence_score" in data["validation"]
        print(f"✅ VIN Decode: {data['year']} {data['make']} {data['model']} (Confidence: {data['validation']['confidence_score']}%)")
    
    def test_vin_decode_with_confidence_score(self):
        """Test VIN decode returns confidence score"""
        vin = "1HGCM82633A123456"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert response.status_code == 200
        data = response.json()
        
        assert "validation" in data
        assert "confidence_score" in data["validation"]
        assert isinstance(data["validation"]["confidence_score"], (int, float))
        assert 0 <= data["validation"]["confidence_score"] <= 100
        print(f"✅ Confidence Score: {data['validation']['confidence_score']}%")
    
    def test_vin_decode_invalid_length(self):
        """Test VIN decode with invalid length"""
        vin = "1HGCM826"  # Too short
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert response.status_code == 400
        print("✅ Invalid VIN length rejected")
    
    def test_vin_decode_invalid_characters(self):
        """Test VIN decode with invalid characters (I, O, Q)"""
        vin = "1HGCM82633A12345I"  # Contains 'I'
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert response.status_code == 400
        print("✅ Invalid VIN characters rejected")
    
    def test_vin_decode_vehicle_specs(self):
        """Test VIN decode returns vehicle specifications"""
        vin = "1HGCM82633A123456"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert response.status_code == 200
        data = response.json()
        
        # Check for vehicle specs
        assert "engine_display" in data or "cylinders" in data
        assert "transmission" in data
        assert "fuel_type" in data
        print(f"✅ Vehicle Specs: Engine={data.get('engine_display', 'N/A')}, Trans={data.get('transmission', 'N/A')}")


class TestTranslationAPI:
    """Translation API tests - en->es translation"""
    
    def test_translate_en_to_es(self):
        """Test English to Spanish translation"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "Hello, how are you?",
                "source_lang": "en",
                "target_lang": "es"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "translated_text" in data
        assert len(data["translated_text"]) > 0
        # Should contain Spanish words
        assert any(word in data["translated_text"].lower() for word in ["hola", "cómo", "estás", "estas"])
        print(f"✅ Translation: 'Hello, how are you?' -> '{data['translated_text']}'")
    
    def test_translate_with_confidence(self):
        """Test translation returns confidence score"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "Good morning",
                "source_lang": "en",
                "target_lang": "es"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "confidence" in data
        assert isinstance(data["confidence"], (int, float))
        print(f"✅ Translation Confidence: {data['confidence']}")
    
    def test_translate_auto_detect(self):
        """Test translation with auto language detection"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "Buenos días",
                "source_lang": "auto",
                "target_lang": "en"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "translated_text" in data
        assert "detected_lang" in data
        print(f"✅ Auto-detect: Detected '{data['detected_lang']}', translated to '{data['translated_text']}'")
    
    def test_translate_empty_text(self):
        """Test translation handles empty text gracefully"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "",
                "source_lang": "en",
                "target_lang": "es"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["translated_text"] == ""
        print("✅ Empty text handled gracefully")
    
    def test_translate_automotive_terms(self):
        """Test translation preserves automotive terminology"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "The VIN number is valid and the APR is 3.9%",
                "source_lang": "en",
                "target_lang": "es"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # VIN and APR should be preserved
        assert "VIN" in data["translated_text"] or "vin" in data["translated_text"].lower()
        print(f"✅ Automotive terms preserved: '{data['translated_text']}'")


class TestTowerTalk:
    """Tower Talk AI response generation tests"""
    
    def test_tower_talk_basic(self):
        """Test Tower Talk generates response"""
        response = requests.post(
            f"{BASE_URL}/api/tower-talk",
            json={
                "situation": "Customer asking about price",
                "context": {
                    "customerName": "John",
                    "vehicle": "2024 Toyota Camry",
                    "dealershipName": "Test Dealership",
                    "salespersonName": "Mike",
                    "salespersonStyle": "friendly"
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "response" in data
        assert len(data["response"]) > 0
        print(f"✅ Tower Talk Response: '{data['response'][:100]}...'")
    
    def test_tower_talk_different_styles(self):
        """Test Tower Talk with different salesperson styles"""
        styles = ["straight_shooter", "friendly", "professional"]
        
        for style in styles:
            response = requests.post(
                f"{BASE_URL}/api/tower-talk",
                json={
                    "situation": "Customer needs to think about it",
                    "context": {
                        "customerName": "Sarah",
                        "vehicle": "2024 Honda Accord",
                        "dealershipName": "Test Dealership",
                        "salespersonName": "Alex",
                        "salespersonStyle": style
                    }
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "response" in data
            print(f"✅ Tower Talk ({style}): Generated response")
    
    def test_tower_talk_with_trade_in(self):
        """Test Tower Talk with trade-in context"""
        response = requests.post(
            f"{BASE_URL}/api/tower-talk",
            json={
                "situation": "Customer wants to know trade-in value",
                "context": {
                    "customerName": "Michael",
                    "vehicle": "2024 Ford F-150",
                    "tradeIn": "2018 Chevrolet Silverado",
                    "dealershipName": "Test Dealership",
                    "salespersonName": "Chris",
                    "salespersonStyle": "friendly"
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "response" in data
        assert len(data["response"]) > 0
        print(f"✅ Tower Talk (with trade-in): Generated response")


class TestCustomerAPI:
    """Customer API tests"""
    
    def test_get_customers(self):
        """Test getting customer list"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        data = response.json()
        
        assert "customers" in data
        assert "count" in data
        print(f"✅ Customers: Found {data['count']} customers")
    
    def test_create_customer(self):
        """Test creating a new customer via Quick Add"""
        import uuid
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/customers/create",
            json={
                "first_name": "TEST_QuickAdd",
                "last_name": "Customer",
                "phone": "555-123-4567",
                "email": test_email,
                "lead_source": "walk_in",
                "lead_status": "new",
                "notes": "Test customer from Quick Add"
            }
        )
        assert response.status_code in [200, 201]
        print(f"✅ Customer Created: TEST_QuickAdd Customer ({test_email})")


class TestVehicleAPI:
    """Vehicle API tests"""
    
    def test_get_vehicles(self):
        """Test getting vehicle list"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        data = response.json()
        
        assert "vehicles" in data
        assert "count" in data
        print(f"✅ Vehicles: Found {data['count']} vehicles")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
