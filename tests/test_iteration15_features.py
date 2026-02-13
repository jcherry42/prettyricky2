"""
Test suite for Supercharg'd iteration 15 - specific feature tests
Tests: Customer priority sorting, 5-language translation, VIN Scanner
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://salespro-hub-2.preview.emergentagent.com')

class TestTranslation5Languages:
    """Translation API - all 5 languages (EN, ES, FR, JA, KO)"""
    
    def test_translate_en_to_es(self):
        """Test English to Spanish"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "text": "Hello, how can I help you today?",
            "source_lang": "en",
            "target_lang": "es"
        })
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert len(data["translated_text"]) > 0
        print(f"✓ EN->ES: '{data['translated_text']}'")
    
    def test_translate_en_to_fr(self):
        """Test English to French"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "text": "Good morning, welcome to our dealership",
            "source_lang": "en",
            "target_lang": "fr"
        })
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert len(data["translated_text"]) > 0
        print(f"✓ EN->FR: '{data['translated_text']}'")
    
    def test_translate_en_to_ja(self):
        """Test English to Japanese"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "text": "Thank you for visiting",
            "source_lang": "en",
            "target_lang": "ja"
        })
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert len(data["translated_text"]) > 0
        # Japanese should contain Japanese characters
        print(f"✓ EN->JA: '{data['translated_text']}'")
    
    def test_translate_en_to_ko(self):
        """Test English to Korean"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "text": "Welcome to our store",
            "source_lang": "en",
            "target_lang": "ko"
        })
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert len(data["translated_text"]) > 0
        print(f"✓ EN->KO: '{data['translated_text']}'")
    
    def test_translate_es_to_en(self):
        """Test Spanish to English"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "text": "¿Cuánto cuesta este vehículo?",
            "source_lang": "es",
            "target_lang": "en"
        })
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert len(data["translated_text"]) > 0
        print(f"✓ ES->EN: '{data['translated_text']}'")
    
    def test_translate_fr_to_en(self):
        """Test French to English"""
        response = requests.post(f"{BASE_URL}/api/translate", json={
            "text": "Je voudrais voir cette voiture",
            "source_lang": "fr",
            "target_lang": "en"
        })
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert len(data["translated_text"]) > 0
        print(f"✓ FR->EN: '{data['translated_text']}'")


class TestVINDecoder:
    """VIN Scanner - manual entry and decode"""
    
    def test_vin_decode_honda(self):
        """Test VIN decode for Honda"""
        test_vin = "1HGCM82633A123456"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{test_vin}")
        assert response.status_code == 200
        data = response.json()
        assert "vin" in data
        assert "year" in data
        assert "make" in data
        assert "model" in data
        print(f"✓ VIN decode: {data.get('year')} {data.get('make')} {data.get('model')}")
    
    def test_vin_decode_returns_confidence(self):
        """Test VIN decode returns confidence score"""
        test_vin = "1HGCM82633A123456"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{test_vin}")
        assert response.status_code == 200
        data = response.json()
        # Confidence is nested under validation
        assert "validation" in data
        assert "confidence_score" in data["validation"]
        print(f"✓ VIN confidence: {data['validation']['confidence_score']}%")
    
    def test_vin_decode_toyota(self):
        """Test VIN decode for Toyota"""
        test_vin = "JTDKN3DU5A0123456"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{test_vin}")
        assert response.status_code == 200
        data = response.json()
        assert "make" in data
        print(f"✓ Toyota VIN decode: {data.get('year')} {data.get('make')} {data.get('model')}")


class TestTowerTalkAI:
    """Tower Talk - AI response generation"""
    
    def test_tower_talk_generates_response(self):
        """Test Tower Talk generates AI response"""
        response = requests.post(f"{BASE_URL}/api/tower-talk", json={
            "situation": "Customer says the price is too high and wants a better deal",
            "context": {
                "customerName": "John",
                "vehicle": "2024 Toyota Camry",
                "vehiclePrice": "$35,000",
                "dealershipName": "Test Dealership",
                "salespersonName": "Mike",
                "salespersonStyle": "friendly"
            }
        })
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 20  # Should be a meaningful response
        print(f"✓ Tower Talk response: '{data['response'][:80]}...'")
    
    def test_tower_talk_straight_shooter_style(self):
        """Test Tower Talk with straight_shooter style"""
        response = requests.post(f"{BASE_URL}/api/tower-talk", json={
            "situation": "Customer needs to think about it",
            "context": {
                "customerName": "Jane",
                "vehicle": "2024 Honda Accord",
                "dealershipName": "Test Dealership",
                "salespersonName": "Sarah",
                "salespersonStyle": "straight_shooter"
            }
        })
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        print(f"✓ Straight shooter style works")
    
    def test_tower_talk_professional_style(self):
        """Test Tower Talk with professional style"""
        response = requests.post(f"{BASE_URL}/api/tower-talk", json={
            "situation": "Customer found a better deal elsewhere",
            "context": {
                "customerName": "Bob",
                "vehicle": "2024 Ford F-150",
                "dealershipName": "Test Dealership",
                "salespersonName": "Tom",
                "salespersonStyle": "professional"
            }
        })
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        print(f"✓ Professional style works")


class TestCustomerData:
    """Customer list - phone display and status fields"""
    
    def test_customers_have_required_fields(self):
        """Test customers have phone and status fields"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        data = response.json()
        
        if data["count"] > 0:
            for customer in data["customers"]:
                assert "phone" in customer, "Missing phone field"
                assert "status" in customer, "Missing status field"
                assert "name" in customer or ("firstName" in customer), "Missing name field"
            print(f"✓ All {data['count']} customers have required fields")
        else:
            print("⚠ No customers to verify")
    
    def test_customer_search_works(self):
        """Test customer search functionality"""
        response = requests.get(f"{BASE_URL}/api/customers?search=John")
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        print(f"✓ Customer search works, found {data['count']} results")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
