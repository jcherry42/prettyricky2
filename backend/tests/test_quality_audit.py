"""
Quality Audit Backend Tests - Iteration 22
Tests for P0 quality audit features including:
- Health API
- Dashboard stats API
- Customer list API
- All core endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL') or os.environ.get('VITE_BACKEND_URL') or 'https://automotive-sales-app.preview.emergentagent.com'
BASE_URL = BASE_URL.rstrip('/')

class TestHealthEndpoints:
    """Health check endpoint tests"""
    
    def test_health_endpoint_returns_200(self):
        """Test /api/health returns 200 with healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "healthy"
        assert "timestamp" in data
        assert "scheduler" in data
        assert "dataSources" in data
        print(f"Health check passed: {data['status']}")
    
    def test_root_endpoint_returns_200(self):
        """Test /api/ root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "version" in data
        print(f"Root endpoint: {data['message']} v{data['version']}")


class TestDashboardStats:
    """Dashboard statistics endpoint tests"""
    
    def test_dashboard_stats_returns_200(self):
        """Test /api/dashboard/stats returns valid stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "customers" in data
        assert "vehicles" in data
        
        # Verify customer stats structure
        customers = data["customers"]
        assert "total" in customers
        assert "new" in customers
        assert "contacted" in customers
        assert "sold" in customers
        
        # Verify vehicles stats structure
        vehicles = data["vehicles"]
        assert "active_inventory" in vehicles
        assert "trade_ins" in vehicles
        assert "total" in vehicles
        
        print(f"Dashboard stats: {customers['total']} customers, {vehicles['total']} vehicles")


class TestCustomerEndpoints:
    """Customer API endpoint tests"""
    
    def test_customers_list_returns_200(self):
        """Test /api/customers/list returns customer list"""
        response = requests.get(f"{BASE_URL}/api/customers/list?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "customers" in data
        assert isinstance(data["customers"], list)
        
        if len(data["customers"]) > 0:
            customer = data["customers"][0]
            # Verify customer structure
            assert "id" in customer
            assert "first_name" in customer or "name" in customer
            print(f"Customer list: {len(data['customers'])} customers returned")
        else:
            print("Customer list: Empty (no customers)")
    
    def test_customers_endpoint_returns_200(self):
        """Test /api/customers returns customer list"""
        response = requests.get(f"{BASE_URL}/api/customers?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "customers" in data
        assert "count" in data
        print(f"Customers endpoint: {data['count']} customers")
    
    def test_customers_stats_returns_200(self):
        """Test /api/customers/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/customers/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total" in data
        assert "byStatus" in data
        print(f"Customer stats: {data['total']} total")


class TestVehicleEndpoints:
    """Vehicle API endpoint tests"""
    
    def test_vehicles_list_returns_200(self):
        """Test /api/vehicles returns vehicle list"""
        response = requests.get(f"{BASE_URL}/api/vehicles?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "vehicles" in data
        assert "count" in data
        print(f"Vehicles endpoint: {data['count']} vehicles")
    
    def test_vehicles_stats_returns_200(self):
        """Test /api/vehicles/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/vehicles/stats")
        assert response.status_code == 200
        
        data = response.json()
        # Should have inventory summary
        print(f"Vehicle stats: {data}")


class TestTranslationEndpoint:
    """Translation API endpoint tests"""
    
    def test_translate_endpoint_returns_200(self):
        """Test /api/translate endpoint"""
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
        print(f"Translation: '{data['translated_text']}'")


class TestTowerTalkEndpoint:
    """Tower Talk AI endpoint tests"""
    
    def test_tower_talk_endpoint_returns_200(self):
        """Test /api/tower-talk AI response generation"""
        response = requests.post(
            f"{BASE_URL}/api/tower-talk",
            json={
                "situation": "New lead inquiry about vehicle availability",
                "context": {
                    "customerName": "Test Customer",
                    "vehicle": "2024 Mercedes S-Class",
                    "dealershipName": "Test Dealership",
                    "salespersonName": "Test Rep"
                }
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 0
        print(f"Tower Talk response generated: {len(data['response'])} chars")


class TestDataSourceEndpoints:
    """Data source API endpoint tests"""
    
    def test_data_sources_list_returns_200(self):
        """Test /api/data-sources returns list"""
        response = requests.get(f"{BASE_URL}/api/data-sources")
        assert response.status_code == 200
        
        data = response.json()
        assert "sources" in data
        assert "schedulerStatus" in data
        print(f"Data sources: {len(data['sources'])} configured")


class TestIntegrationEndpoints:
    """Integration API endpoint tests"""
    
    def test_integrations_adapters_returns_200(self):
        """Test /api/integrations/adapters returns adapter list"""
        response = requests.get(f"{BASE_URL}/api/integrations/adapters")
        assert response.status_code == 200
        
        data = response.json()
        assert "adapters" in data
        print(f"Integration adapters: {len(data['adapters'])} available")
    
    def test_integrations_schema_customers_returns_200(self):
        """Test /api/integrations/schema/customers returns schema"""
        response = requests.get(f"{BASE_URL}/api/integrations/schema/customers")
        assert response.status_code == 200
        
        data = response.json()
        assert "schema" in data
        assert "required" in data
        print(f"Customer schema: {len(data['schema'])} fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
