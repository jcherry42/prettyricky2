"""
Comprehensive Backend API Tests for Supercharg'd Automotive Sales App
Tests all CRUD operations, AI endpoints, and scanner features
"""
import pytest
import requests
import os
import json
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://state-license-scan.preview.emergentagent.com')

class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get('status') == 'healthy'
        print(f"✓ Health check passed: {data.get('status')}")


class TestDashboardStats:
    """Dashboard statistics endpoint tests"""
    
    def test_dashboard_stats(self):
        """Test /api/dashboard/stats returns customer and vehicle counts"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Verify customer stats
        assert 'customers' in data
        assert 'total' in data['customers']
        assert 'new' in data['customers']
        
        # Verify vehicle stats
        assert 'vehicles' in data
        assert 'active_inventory' in data['vehicles']
        
        print(f"✓ Dashboard stats: {data['customers']['total']} customers, {data['vehicles']['active_inventory']} vehicles")


class TestCustomersCRUD:
    """Customer CRUD endpoint tests"""
    
    def test_list_customers(self):
        """Test /api/customers/list returns customer list"""
        response = requests.get(f"{BASE_URL}/api/customers/list?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert 'customers' in data
        assert isinstance(data['customers'], list)
        print(f"✓ Listed {len(data['customers'])} customers")
    
    def test_create_customer(self):
        """Test POST /api/customers/create creates a new customer"""
        unique_id = uuid.uuid4().hex[:8]
        customer_data = {
            "first_name": f"TEST_{unique_id}",
            "last_name": "TestCustomer",
            "phone": "555-999-8888",
            "email": f"test_{unique_id}@example.com",
            "lead_source": "walk_in",
            "lead_status": "new"
        }
        
        response = requests.post(f"{BASE_URL}/api/customers/create", json=customer_data)
        assert response.status_code in [200, 201]
        data = response.json()
        
        # Verify customer was created
        assert data.get('success') is True
        assert 'customer' in data
        customer = data.get('customer')
        assert customer.get('first_name') == customer_data['first_name']
        
        print(f"✓ Created customer: {customer.get('first_name')} {customer.get('last_name')}")
        assert customer.get('id')
    
    def test_get_customer_by_id(self):
        """Test GET /api/customers/{id} returns customer details"""
        # First get list to find a customer
        list_response = requests.get(f"{BASE_URL}/api/customers/list?limit=1")
        customers = list_response.json().get('customers', [])
        
        if customers:
            customer_id = customers[0].get('id')
            response = requests.get(f"{BASE_URL}/api/customers/{customer_id}")
            assert response.status_code == 200
            data = response.json()
            assert data.get('id') == customer_id
            print(f"✓ Retrieved customer: {data.get('first_name')} {data.get('last_name')}")
        else:
            pytest.skip("No customers available to test")
    
    def test_search_customers(self):
        """Test /api/customers with search parameter"""
        response = requests.get(f"{BASE_URL}/api/customers?search=test")
        assert response.status_code == 200
        data = response.json()
        assert 'customers' in data
        print(f"✓ Search returned {len(data['customers'])} results")


class TestVehiclesCRUD:
    """Vehicle CRUD endpoint tests"""
    
    def test_list_vehicles(self):
        """Test /api/vehicles/inventory returns vehicle list"""
        response = requests.get(f"{BASE_URL}/api/vehicles/inventory")
        assert response.status_code == 200
        data = response.json()
        assert 'vehicles' in data
        assert isinstance(data['vehicles'], list)
        print(f"✓ Listed {len(data['vehicles'])} vehicles")
    
    def test_vehicle_stats(self):
        """Test /api/vehicles/stats returns inventory statistics"""
        response = requests.get(f"{BASE_URL}/api/vehicles/stats")
        assert response.status_code == 200
        _ = response.json()
        print("✓ Vehicle stats retrieved")
    
    def test_filter_vehicles_by_category(self):
        """Test filtering vehicles by category"""
        response = requests.get(f"{BASE_URL}/api/vehicles/inventory?category=active_inventory")
        assert response.status_code == 200
        data = response.json()
        assert 'vehicles' in data
        print(f"✓ Filtered vehicles: {len(data['vehicles'])} in active inventory")


class TestVINScanner:
    """VIN Scanner endpoint tests"""
    
    def test_vin_decode_valid(self):
        """Test /api/vin/decode/{vin} with valid VIN"""
        test_vin = "1FA6P8TH1J5117440"  # 2018 Ford Mustang
        response = requests.get(f"{BASE_URL}/api/vin/decode/{test_vin}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify decoded data
        assert data.get('success') is True or 'year' in data
        if 'year' in data:
            assert data.get('year') == '2018' or data.get('year') == 2018
            assert 'FORD' in data.get('make', '').upper() or 'Ford' in data.get('make', '')
        
        print(f"✓ VIN decoded: {data.get('year')} {data.get('make')} {data.get('model')}")
    
    def test_vin_decode_invalid(self):
        """Test /api/vin/decode/{vin} with invalid VIN"""
        invalid_vin = "INVALID123456789"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{invalid_vin}")
        # Should return 400 or 200 with error
        assert response.status_code in [200, 400]
        print("✓ Invalid VIN handled correctly")
    
    def test_vin_save_to_inventory(self):
        """Test /api/vin/save-to-inventory endpoint"""
        unique_vin = f"1HGBH41JXMN{uuid.uuid4().hex[:6].upper()}"
        test_data = {
            "vin": unique_vin,
            "vehicle_data": {
                "year": 2023,
                "make": "Honda",
                "model": "Civic",
                "trim": "LX"
            },
            "category": "active_inventory"
        }
        
        response = requests.post(f"{BASE_URL}/api/vin/save-to-inventory", json=test_data)
        # May return 200 (success), 409 (duplicate), or other
        assert response.status_code in [200, 201, 409]
        print(f"✓ VIN save to inventory endpoint working (status: {response.status_code})")


class TestTowerTalkAI:
    """Tower Talk AI endpoint tests"""
    
    def test_generate_response(self):
        """Test /api/tower-talk endpoint"""
        request_data = {
            "situation": "Price Too High",
            "context": {
                "customer_name": "Alex Martinez",
                "vehicle_interest": "2024 BMW X3",
                "inquiry_type": "objection"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/tower-talk", json=request_data)
        assert response.status_code == 200
        data = response.json()
        
        # Should return generated response
        assert 'response' in data
        print(f"✓ Tower Talk AI response generated: {data['response'][:50]}...")


class TestVoiceTranslator:
    """Voice Translator endpoint tests"""
    
    def test_translate_text(self):
        """Test /api/translate endpoint"""
        request_data = {
            "text": "Hello, how can I help you today?",
            "source_lang": "en",
            "target_lang": "es"
        }
        
        response = requests.post(f"{BASE_URL}/api/translate", json=request_data)
        assert response.status_code == 200
        data = response.json()
        
        # Should return translated text
        assert 'translated_text' in data
        print(f"✓ Voice translation working: '{data['translated_text']}'")


class TestLicenseScanner:
    """License Scanner endpoint tests"""
    
    def test_license_create_customer(self):
        """Test /api/license/create-customer endpoint"""
        unique_id = uuid.uuid4().hex[:8]
        form_data = {
            "first_name": f"TEST_License_{unique_id}",
            "last_name": "TestUser",
            "address": "123 Test Street",
            "city": "Test City",
            "state": "CA",
            "zip_code": "90210",
            "image_url": "/api/uploads/test.jpg"
        }
        
        response = requests.post(f"{BASE_URL}/api/license/create-customer", data=form_data)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('success') is True
        assert 'customer' in data
        print("✓ License customer creation working")


class TestDataImport:
    """Data import endpoint tests"""
    
    def test_import_preview(self):
        """Test /api/import/preview endpoint"""
        request_data = {
            "content": "first_name,last_name,phone\nJohn,Doe,555-123-4567",
            "format": "csv",
            "data_type": "customers"
        }
        
        response = requests.post(f"{BASE_URL}/api/import/preview", json=request_data)
        assert response.status_code == 200
        print("✓ Import preview working")


class TestIntegrations:
    """CRM Integration endpoint tests"""
    
    def test_list_adapters(self):
        """Test /api/integrations/adapters endpoint"""
        response = requests.get(f"{BASE_URL}/api/integrations/adapters")
        assert response.status_code == 200
        data = response.json()
        assert 'adapters' in data
        print(f"✓ Listed {len(data['adapters'])} integration adapters")
    
    def test_get_schema(self):
        """Test /api/integrations/schema/{data_type} endpoint"""
        response = requests.get(f"{BASE_URL}/api/integrations/schema/customers")
        assert response.status_code == 200
        data = response.json()
        assert 'schema' in data
        print("✓ Customer schema retrieved")


class TestConversations:
    """Conversation/Response Cards endpoint tests"""
    
    def test_get_categories(self):
        """Test /api/conversations/categories endpoint"""
        response = requests.get(f"{BASE_URL}/api/conversations/categories")
        assert response.status_code == 200
        _ = response.json()
        print("✓ Conversation categories retrieved")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
