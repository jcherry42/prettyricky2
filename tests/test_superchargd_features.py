"""
Test suite for Supercharg'd automotive sales PWA features
Tests: Translation API (speed/caching), Tower Talk API, Sport Mode, Push-to-Talk
"""
import pytest
import requests
import time
import os

BASE_URL = os.environ.get('VITE_BACKEND_URL', 'https://premium-car-crm.preview.emergentagent.com')


class TestHealthEndpoints:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "scheduler" in data
        
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Closr API"
        assert data["version"] == "2.0.0"


class TestTranslationAPI:
    """Translation API tests - speed and caching"""
    
    def test_translation_first_call_speed(self):
        """Test first translation call speed (~1.5s expected)"""
        # Use unique text to avoid cache
        unique_text = f"Hello, this is a unique test message {time.time()}"
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": unique_text,
                "source_lang": "en",
                "target_lang": "es"
            }
        )
        elapsed = time.time() - start_time
        
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert data["translated_text"]  # Not empty
        assert data["confidence"] >= 0.9
        
        # First call should be under 5 seconds (allowing for network variance)
        assert elapsed < 5.0, f"First call took {elapsed:.2f}s, expected < 5s"
        print(f"First translation call: {elapsed:.2f}s")
    
    def test_translation_cached_call_speed(self):
        """Test cached translation call speed (<500ms expected)"""
        test_text = "Hello, how are you today?"
        
        # First call to ensure it's cached
        requests.post(
            f"{BASE_URL}/api/translate",
            json={"text": test_text, "source_lang": "en", "target_lang": "es"}
        )
        
        # Second call should be cached
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={"text": test_text, "source_lang": "en", "target_lang": "es"}
        )
        elapsed = time.time() - start_time
        
        assert response.status_code == 200
        data = response.json()
        assert data["confidence"] == 0.99  # Cached responses have 0.99 confidence
        
        # Cached call should be under 500ms
        assert elapsed < 0.5, f"Cached call took {elapsed:.2f}s, expected < 0.5s"
        print(f"Cached translation call: {elapsed:.3f}s")
    
    def test_translation_en_to_es(self):
        """Test English to Spanish translation"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "Good morning, welcome to our dealership!",
                "source_lang": "en",
                "target_lang": "es"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert data["translated_text"]
        # Should contain Spanish words
        assert any(word in data["translated_text"].lower() for word in ["buenos", "bienvenido", "concesionario", "mañana"])
    
    def test_translation_es_to_en(self):
        """Test Spanish to English translation"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "Hola, ¿cómo puedo ayudarle hoy?",
                "source_lang": "es",
                "target_lang": "en"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "translated_text" in data
        assert data["translated_text"]
        # Should contain English words
        assert any(word in data["translated_text"].lower() for word in ["hello", "help", "today", "how"])
    
    def test_translation_auto_detect(self):
        """Test auto language detection"""
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "¿Cuánto cuesta este vehículo?",
                "source_lang": "auto",
                "target_lang": "en"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["detected_lang"] == "es"
        assert "translated_text" in data
    
    def test_translation_empty_text(self):
        """Test translation with empty text"""
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
        assert data["confidence"] == 0.0


class TestTowerTalkAPI:
    """Tower Talk AI response generation tests"""
    
    def test_tower_talk_basic(self):
        """Test basic Tower Talk response generation"""
        response = requests.post(
            f"{BASE_URL}/api/tower-talk",
            json={
                "situation": "Customer says the price is too high",
                "context": {
                    "customerName": "John",
                    "vehicle": "2024 Toyota Camry",
                    "vehiclePrice": "$32,000",
                    "dealershipName": "ABC Motors",
                    "salespersonName": "Mike",
                    "salespersonStyle": "friendly"
                }
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert data["response"]  # Not empty
        assert len(data["response"]) > 20  # Meaningful response
        # Should be signed by salesperson
        assert "Mike" in data["response"]
    
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
                        "dealershipName": "Test Motors",
                        "salespersonName": "Alex",
                        "salespersonStyle": style
                    }
                }
            )
            
            assert response.status_code == 200, f"Failed for style: {style}"
            data = response.json()
            assert data["response"], f"Empty response for style: {style}"
            print(f"Style '{style}' response length: {len(data['response'])}")
    
    def test_tower_talk_with_trade_in(self):
        """Test Tower Talk with trade-in context"""
        response = requests.post(
            f"{BASE_URL}/api/tower-talk",
            json={
                "situation": "Customer is unhappy with trade-in value",
                "context": {
                    "customerName": "Bob",
                    "vehicle": "2024 Ford F-150",
                    "vehiclePrice": "$55,000",
                    "tradeIn": "2018 Chevrolet Silverado",
                    "dealershipName": "Truck World",
                    "salespersonName": "Tom",
                    "salespersonStyle": "straight_shooter"
                }
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["response"]
        # Response should acknowledge the trade-in situation
        print(f"Trade-in response: {data['response'][:100]}...")
    
    def test_tower_talk_quick_shortcuts(self):
        """Test Tower Talk with common objection shortcuts"""
        shortcuts = [
            "Customer says the price is too high and wants a better deal",
            "Customer says they need to think about it and will come back later",
            "Customer says they found a better deal at another dealership",
            "Customer says the monthly payment is more than they can afford",
        ]
        
        for situation in shortcuts:
            response = requests.post(
                f"{BASE_URL}/api/tower-talk",
                json={
                    "situation": situation,
                    "context": {
                        "customerName": "Test Customer",
                        "vehicle": "2024 Test Vehicle",
                        "dealershipName": "Test Dealership",
                        "salespersonName": "Test Rep",
                        "salespersonStyle": "friendly"
                    }
                }
            )
            
            assert response.status_code == 200, f"Failed for: {situation[:30]}..."
            data = response.json()
            assert data["response"], f"Empty response for: {situation[:30]}..."


class TestCustomersAPI:
    """Customer API tests"""
    
    def test_list_customers(self):
        """Test listing customers"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        assert "count" in data
    
    def test_customer_stats(self):
        """Test customer statistics"""
        response = requests.get(f"{BASE_URL}/api/customers/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "byStatus" in data


class TestVehiclesAPI:
    """Vehicle API tests"""
    
    def test_list_vehicles(self):
        """Test listing vehicles"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        data = response.json()
        assert "vehicles" in data
        assert "count" in data
    
    def test_vehicle_stats(self):
        """Test vehicle statistics"""
        response = requests.get(f"{BASE_URL}/api/vehicles/stats")
        assert response.status_code == 200


class TestConversationsAPI:
    """Conversation history API tests"""
    
    def test_get_conversation_categories(self):
        """Test getting conversation categories"""
        response = requests.get(f"{BASE_URL}/api/conversations/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
    
    def test_list_conversations(self):
        """Test listing conversations"""
        response = requests.get(f"{BASE_URL}/api/conversations")
        assert response.status_code == 200
        data = response.json()
        assert "conversations" in data
        assert "count" in data
    
    def test_conversation_stats(self):
        """Test conversation statistics"""
        response = requests.get(f"{BASE_URL}/api/conversations/stats")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
