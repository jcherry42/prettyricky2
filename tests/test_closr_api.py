"""
CLOSR API Backend Tests
Tests for theme/supercharged features, translation API, and template downloads
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasicEndpoints:
    """Health check and basic API tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "scheduler" in data
        print(f"✓ Health check passed: {data['status']}")
    
    def test_root_endpoint(self):
        """Test /api/ returns API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Closr" in data["message"]
        print(f"✓ Root endpoint: {data['message']}")


class TestTranslationAPI:
    """Tests for /api/translate endpoint (Supercharg'd mode)"""
    
    def test_translate_english_to_spanish(self):
        """Test translating English text to Spanish"""
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
        # Should contain Spanish characters or words
        translated = data["translated_text"].lower()
        assert any(word in translated for word in ["hola", "cómo", "estás", "como", "estas"])
        print(f"✓ EN→ES translation: '{data['translated_text']}'")
    
    def test_translate_spanish_to_english(self):
        """Test translating Spanish text to English"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "Hola, ¿cómo estás?",
                "source_lang": "es",
                "target_lang": "en"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert len(data["translated_text"]) > 0
        # Should contain English words
        translated = data["translated_text"].lower()
        assert any(word in translated for word in ["hello", "hi", "how", "are", "you"])
        print(f"✓ ES→EN translation: '{data['translated_text']}'")
    
    def test_translate_auto_detect(self):
        """Test auto-detection of source language"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "Buenos días, me gustaría saber sobre el financiamiento",
                "source_lang": "auto",
                "target_lang": "en"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert "detected_lang" in data
        # Should detect Spanish and translate to English
        assert data["detected_lang"] == "es"
        print(f"✓ Auto-detect translation: detected={data['detected_lang']}, result='{data['translated_text'][:50]}...'")
    
    def test_translate_empty_text(self):
        """Test translation with empty text returns empty"""
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
        print("✓ Empty text translation handled correctly")


class TestTowerTalkAPI:
    """Tests for /api/tower-talk endpoint"""
    
    def test_tower_talk_basic(self):
        """Test basic Tower Talk response generation"""
        response = requests.post(
            f"{BASE_URL}/api/tower-talk",
            json={
                "situation": "Customer is interested in financing options",
                "context": {
                    "customerName": "John",
                    "vehicle": "2024 Honda Accord",
                    "vehiclePrice": "$32,000",
                    "dealershipName": "AutoMax",
                    "salespersonName": "Mike",
                    "salespersonStyle": "friendly"
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 0
        # Response should mention customer name or vehicle
        response_text = data["response"].lower()
        assert any(word in response_text for word in ["john", "accord", "financing", "mike"])
        print(f"✓ Tower Talk response generated: '{data['response'][:100]}...'")
    
    def test_tower_talk_with_trade_in(self):
        """Test Tower Talk with trade-in context"""
        response = requests.post(
            f"{BASE_URL}/api/tower-talk",
            json={
                "situation": "Customer wants to trade in their old car",
                "context": {
                    "customerName": "Sarah",
                    "vehicle": "2024 Toyota Camry",
                    "tradeIn": "2019 Honda Civic",
                    "dealershipName": "AutoMax",
                    "salespersonName": "Lisa",
                    "salespersonStyle": "professional"
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 0
        print(f"✓ Tower Talk with trade-in: '{data['response'][:100]}...'")


class TestTemplateDownloads:
    """Tests for downloadable data import templates"""
    
    def test_customers_template_accessible(self):
        """Test customers template CSV is accessible"""
        response = requests.get(f"{BASE_URL}/templates/customers_template.csv")
        assert response.status_code == 200
        content = response.text
        # Check CSV headers
        assert "first_name" in content.lower()
        assert "last_name" in content.lower()
        assert "phone" in content.lower()
        assert "email" in content.lower()
        print(f"✓ Customers template accessible, {len(content)} bytes")
    
    def test_vehicles_template_accessible(self):
        """Test vehicles template CSV is accessible"""
        response = requests.get(f"{BASE_URL}/templates/vehicles_template.csv")
        assert response.status_code == 200
        content = response.text
        # Check CSV headers
        assert "year" in content.lower()
        assert "make" in content.lower()
        assert "model" in content.lower()
        assert "price" in content.lower()
        print(f"✓ Vehicles template accessible, {len(content)} bytes")
    
    def test_customers_template_has_sample_data(self):
        """Test customers template has sample data rows"""
        response = requests.get(f"{BASE_URL}/templates/customers_template.csv")
        assert response.status_code == 200
        lines = response.text.strip().split('\n')
        assert len(lines) > 1, "Template should have header + sample data"
        print(f"✓ Customers template has {len(lines)-1} sample rows")
    
    def test_vehicles_template_has_sample_data(self):
        """Test vehicles template has sample data rows"""
        response = requests.get(f"{BASE_URL}/templates/vehicles_template.csv")
        assert response.status_code == 200
        lines = response.text.strip().split('\n')
        assert len(lines) > 1, "Template should have header + sample data"
        print(f"✓ Vehicles template has {len(lines)-1} sample rows")


class TestDataSourcesAPI:
    """Tests for data sources management"""
    
    def test_list_data_sources(self):
        """Test listing data sources"""
        response = requests.get(f"{BASE_URL}/api/data-sources")
        assert response.status_code == 200
        data = response.json()
        assert "sources" in data
        assert "schedulerStatus" in data
        print(f"✓ Data sources list: {len(data['sources'])} sources")
    
    def test_customers_endpoint(self):
        """Test customers list endpoint"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        assert "count" in data
        print(f"✓ Customers endpoint: {data['count']} customers")
    
    def test_vehicles_endpoint(self):
        """Test vehicles list endpoint"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        data = response.json()
        assert "vehicles" in data
        assert "count" in data
        print(f"✓ Vehicles endpoint: {data['count']} vehicles")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
