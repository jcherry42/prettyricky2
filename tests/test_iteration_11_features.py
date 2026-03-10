"""
Test Suite for Iteration 11 Features
Tests: VIN Scanner decode with confidence score, Dashboard stats, Customers list, Vehicles list
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://car-data-hub-9.preview.emergentagent.com')


class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_check(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "scheduler" in data
        assert "dataSources" in data


class TestDashboardStats:
    """Dashboard statistics API tests"""
    
    def test_dashboard_stats_returns_200(self):
        """Test dashboard stats endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        
    def test_dashboard_stats_structure(self):
        """Test dashboard stats returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        data = response.json()
        
        # Verify customers section
        assert "customers" in data
        assert "total" in data["customers"]
        assert "new" in data["customers"]
        assert "contacted" in data["customers"]
        assert "qualified" in data["customers"]
        assert "sold" in data["customers"]
        
        # Verify vehicles section
        assert "vehicles" in data
        assert "active_inventory" in data["vehicles"]
        assert "trade_ins" in data["vehicles"]
        assert "total" in data["vehicles"]
        
    def test_dashboard_stats_values_are_integers(self):
        """Test dashboard stats values are integers"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        data = response.json()
        
        # All customer counts should be integers
        for key in ["total", "new", "contacted", "qualified", "sold"]:
            assert isinstance(data["customers"][key], int)
            
        # All vehicle counts should be integers
        for key in ["active_inventory", "trade_ins", "total"]:
            assert isinstance(data["vehicles"][key], int)


class TestCustomersAPI:
    """Customers list API tests"""
    
    def test_customers_list_returns_200(self):
        """Test customers list endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        
    def test_customers_list_structure(self):
        """Test customers list returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/customers")
        data = response.json()
        
        assert "customers" in data
        assert "count" in data
        assert isinstance(data["customers"], list)
        assert isinstance(data["count"], int)
        
    def test_customers_list_customer_fields(self):
        """Test customer objects have required fields"""
        response = requests.get(f"{BASE_URL}/api/customers")
        data = response.json()
        
        if data["count"] > 0:
            customer = data["customers"][0]
            # Check for essential fields
            assert "id" in customer
            assert "name" in customer or ("firstName" in customer and "lastName" in customer)


class TestVehiclesAPI:
    """Vehicles list API tests"""
    
    def test_vehicles_list_returns_200(self):
        """Test vehicles list endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        
    def test_vehicles_list_structure(self):
        """Test vehicles list returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        data = response.json()
        
        assert "vehicles" in data
        assert "count" in data
        assert isinstance(data["vehicles"], list)
        assert isinstance(data["count"], int)
        
    def test_vehicles_list_vehicle_fields(self):
        """Test vehicle objects have required fields"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        data = response.json()
        
        if data["count"] > 0:
            vehicle = data["vehicles"][0]
            # Check for essential fields
            assert "id" in vehicle
            assert "year" in vehicle
            assert "make" in vehicle
            assert "model" in vehicle


class TestVINDecoder:
    """VIN Scanner decode API tests with confidence score"""
    
    def test_vin_decode_tesla_returns_200(self):
        """Test VIN decode for Tesla returns 200"""
        vin = "5YJSA1E29HF000001"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert response.status_code == 200
        
    def test_vin_decode_tesla_vehicle_data(self):
        """Test VIN decode returns correct Tesla vehicle data"""
        vin = "5YJSA1E29HF000001"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        data = response.json()
        
        assert data["vin"] == vin
        assert data["make"] == "TESLA"
        assert data["model"] == "Model S"
        assert data["year"] == "2017"
        assert data["fuel_type"] == "Electric"
        
    def test_vin_decode_corvette_returns_200(self):
        """Test VIN decode for Corvette returns 200"""
        vin = "1G1YY22G965104756"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert response.status_code == 200
        
    def test_vin_decode_corvette_vehicle_data(self):
        """Test VIN decode returns correct Corvette vehicle data"""
        vin = "1G1YY22G965104756"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        data = response.json()
        
        assert data["vin"] == vin
        assert data["make"] == "CHEVROLET"
        assert data["model"] == "Corvette"
        assert data["year"] == "2006"
        
    def test_vin_decode_has_confidence_score(self):
        """Test VIN decode returns confidence score in validation object"""
        vin = "5YJSA1E29HF000001"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        data = response.json()
        
        # Verify validation object exists with confidence score
        assert "validation" in data
        assert "confidence_score" in data["validation"]
        assert isinstance(data["validation"]["confidence_score"], int)
        assert 0 <= data["validation"]["confidence_score"] <= 100
        
    def test_vin_decode_validation_fields(self):
        """Test VIN decode validation object has all required fields"""
        vin = "5YJSA1E29HF000001"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        data = response.json()
        
        validation = data["validation"]
        assert "confidence_score" in validation
        assert "checksum_valid" in validation
        assert "sources_checked" in validation
        assert "manufacturer_verified" in validation
        
        # Verify sources_checked is a list
        assert isinstance(validation["sources_checked"], list)
        assert len(validation["sources_checked"]) > 0
        
    def test_vin_decode_invalid_length(self):
        """Test VIN decode rejects invalid VIN length"""
        vin = "12345"  # Too short
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert response.status_code == 400
        
    def test_vin_decode_invalid_characters(self):
        """Test VIN decode rejects VINs with invalid characters (I, O, Q)"""
        vin = "5YJSA1E29HF00000I"  # Contains 'I'
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        assert response.status_code == 400
        
    def test_vin_decode_has_safety_features(self):
        """Test VIN decode returns safety features array"""
        vin = "5YJSA1E29HF000001"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        data = response.json()
        
        # Tesla should have safety features
        assert "safety_features" in data
        assert isinstance(data["safety_features"], list)
        assert len(data["safety_features"]) > 0
        
    def test_vin_decode_has_assembly_location(self):
        """Test VIN decode returns assembly location"""
        vin = "5YJSA1E29HF000001"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}")
        data = response.json()
        
        assert "assembly_location" in data
        assert "FREMONT" in data["assembly_location"]


class TestCustomersListEndpoint:
    """Test /api/customers/list endpoint (used by Command Center)"""
    
    def test_customers_list_endpoint_returns_200(self):
        """Test customers list endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/customers/list")
        assert response.status_code == 200
        
    def test_customers_list_with_limit(self):
        """Test customers list with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/customers/list?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data


class TestVehiclesInventoryEndpoint:
    """Test /api/vehicles/inventory endpoint (used by Command Center)"""
    
    def test_vehicles_inventory_returns_200(self):
        """Test vehicles inventory endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/vehicles/inventory")
        assert response.status_code == 200
        
    def test_vehicles_inventory_structure(self):
        """Test vehicles inventory returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/vehicles/inventory")
        data = response.json()
        assert "vehicles" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
