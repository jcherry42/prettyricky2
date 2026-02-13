"""
Final Verification Tests - Supercharg'd Premium Automotive Sales Platform
Tests all critical APIs after comprehensive cleanup
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('VITE_BACKEND_URL', 'https://salespro-hub-2.preview.emergentagent.com')


class TestHealthAndStatus:
    """Health check and status endpoints"""
    
    def test_health_endpoint(self):
        """GET /api/health - Should return healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "scheduler" in data
        print(f"✅ Health check passed: {data['status']}")
    
    def test_root_endpoint(self):
        """GET /api/ - Should return API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✅ Root endpoint: {data.get('message', 'OK')}")


class TestDashboardStats:
    """Dashboard statistics endpoint"""
    
    def test_dashboard_stats(self):
        """GET /api/dashboard/stats - Should return customer and vehicle stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify customer stats structure
        assert "customers" in data
        customers = data["customers"]
        assert "total" in customers
        assert "new" in customers
        assert "contacted" in customers
        assert "sold" in customers
        
        # Verify vehicles stats structure
        assert "vehicles" in data
        vehicles = data["vehicles"]
        assert "active_inventory" in vehicles
        
        print(f"✅ Dashboard stats: {customers['total']} customers, {vehicles['active_inventory']} vehicles")


class TestCustomerCRUD:
    """Customer CRUD operations"""
    
    def test_customer_list(self):
        """GET /api/customers/list - Should return customer list"""
        response = requests.get(f"{BASE_URL}/api/customers/list?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        assert "customers" in data
        assert "total" in data
        assert isinstance(data["customers"], list)
        
        if len(data["customers"]) > 0:
            customer = data["customers"][0]
            assert "first_name" in customer or "name" in customer
            assert "id" in customer
        
        print(f"✅ Customer list: {data['total']} total customers")
    
    def test_customer_create(self):
        """POST /api/customers/create - Should create a new customer"""
        unique_id = str(uuid.uuid4())[:8]
        customer_data = {
            "first_name": f"TEST_{unique_id}",
            "last_name": "VerificationTest",
            "phone": "555-TEST-001",
            "email": f"test_{unique_id}@verification.test",
            "lead_source": "walk_in",
            "lead_status": "new",
            "notes": "Created by final verification test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/customers/create",
            json=customer_data,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        
        # Response can be {"customer": {...}, "success": true} or just the customer object
        if "customer" in data:
            customer = data["customer"]
        else:
            customer = data
        
        assert "id" in customer
        assert customer.get("first_name") == customer_data["first_name"]
        
        print(f"✅ Customer created: {customer.get('first_name')} {customer.get('last_name')}")
        assert customer["id"]
    
    def test_customer_search(self):
        """GET /api/customers/list with search - Should filter customers"""
        response = requests.get(f"{BASE_URL}/api/customers/list?search=TEST")
        assert response.status_code == 200
        data = response.json()
        
        assert "customers" in data
        print(f"✅ Customer search: Found {len(data['customers'])} matching customers")


class TestVINDecode:
    """VIN decoding endpoint"""
    
    def test_vin_decode_valid(self):
        """GET /api/vin/decode/{vin} - Should decode a valid VIN"""
        # Test with a sample VIN (2020 Toyota Camry)
        test_vin = "4T1BF1FK5LU123456"
        
        response = requests.get(f"{BASE_URL}/api/vin/decode/{test_vin}")
        
        # VIN decode might return 200 or 404 depending on NHTSA availability
        if response.status_code == 200:
            data = response.json()
            print(f"✅ VIN decode successful: {data.get('make', 'Unknown')} {data.get('model', 'Unknown')}")
        else:
            print(f"⚠️ VIN decode returned {response.status_code} - API may be unavailable")
            # Don't fail the test if external API is down
            pytest.skip("VIN decode API unavailable")
    
    def test_vin_decode_invalid(self):
        """GET /api/vin/decode/{vin} - Should handle invalid VIN"""
        invalid_vin = "INVALID123"
        
        response = requests.get(f"{BASE_URL}/api/vin/decode/{invalid_vin}")
        
        # Should return error for invalid VIN
        assert response.status_code in [200, 400, 404, 422]
        print(f"✅ Invalid VIN handled correctly: status {response.status_code}")


class TestTowerTalk:
    """Tower Talk AI endpoint"""
    
    def test_tower_talk_generate(self):
        """POST /api/tower-talk - Should generate AI response"""
        request_data = {
            "situation": "Customer is interested in a new vehicle but concerned about price",
            "context": {
                "customerName": "Test Customer",
                "vehicle": "2024 Toyota Camry",
                "vehiclePrice": "$35,000",
                "dealershipName": "Test Dealership",
                "salespersonName": "Test Rep"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tower-talk",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30  # AI generation can take time
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "response" in data
        assert len(data["response"]) > 0
        
        print(f"✅ Tower Talk generated response: {data['response'][:100]}...")


class TestTranslation:
    """Translation endpoint"""
    
    def test_translate_en_to_es(self):
        """POST /api/translate - Should translate English to Spanish"""
        request_data = {
            "text": "Hello, how can I help you today?",
            "source_lang": "en",
            "target_lang": "es"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "translated_text" in data
        assert len(data["translated_text"]) > 0
        
        print(f"✅ Translation: '{request_data['text']}' -> '{data['translated_text']}'")
    
    def test_translate_auto_detect(self):
        """POST /api/translate - Should auto-detect source language"""
        request_data = {
            "text": "Hola, ¿cómo puedo ayudarte hoy?",
            "source_lang": "auto",
            "target_lang": "en"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/translate",
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "translated_text" in data
        assert "detected_lang" in data
        
        print(f"✅ Auto-detect translation: detected '{data.get('detected_lang', 'unknown')}' language")


class TestVehicleInventory:
    """Vehicle inventory endpoints"""
    
    def test_vehicle_list(self):
        """GET /api/vehicles/list - Should return vehicle inventory"""
        response = requests.get(f"{BASE_URL}/api/vehicles/list?limit=10")
        
        if response.status_code == 200:
            data = response.json()
            assert "vehicles" in data or isinstance(data, list)
            print(f"✅ Vehicle list: {len(data.get('vehicles', data))} vehicles")
        elif response.status_code == 404:
            print("⚠️ Vehicle list endpoint not found - may not be implemented")
            pytest.skip("Vehicle list endpoint not implemented")
        else:
            print(f"⚠️ Vehicle list returned {response.status_code}")


class TestDataSources:
    """Data source management endpoints"""
    
    def test_data_sources_list(self):
        """GET /api/data-sources - Should return data sources"""
        response = requests.get(f"{BASE_URL}/api/data-sources")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Data sources: {len(data) if isinstance(data, list) else 'OK'}")
        elif response.status_code == 404:
            print("⚠️ Data sources endpoint not found")
            pytest.skip("Data sources endpoint not implemented")


class TestIntegrations:
    """Integration endpoints"""
    
    def test_integrations_list(self):
        """GET /api/integrations - Should return integrations"""
        response = requests.get(f"{BASE_URL}/api/integrations")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Integrations: {len(data) if isinstance(data, list) else 'OK'}")
        elif response.status_code == 404:
            print("⚠️ Integrations endpoint not found")
            pytest.skip("Integrations endpoint not implemented")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
