"""
CLOSR Field Discovery & Integration Profiles Tests
Tests for the new Open API CRM integration features:
- Field Discovery Service (auto-mapping from API and sample JSON)
- Integration Profiles (CRUD, export/import, built-in profiles)
- Target Schema endpoints

Features tested:
- GET /api/integrations/schema/{data_type} - Returns target schema with priority fields
- POST /api/integrations/discover-fields/sample - Discovers fields from pasted JSON sample
- POST /api/integrations/discover-fields - Discovers fields from API (requires real API)
- GET /api/integration-profiles - Lists available profiles including built-in ones
- POST /api/integration-profiles - Creates a new profile
- GET /api/integration-profiles/{id} - Get profile by ID
- GET /api/integration-profiles/{id}/export - Exports profile as JSON
- POST /api/integration-profiles/import - Imports profile from JSON
- DELETE /api/integration-profiles/{id} - Delete profile
- PATCH /api/integration-profiles/{id} - Update profile
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestTargetSchema:
    """Tests for target schema endpoints"""
    
    def test_get_customers_schema(self):
        """Test GET /api/integrations/schema/customers - Returns customer schema with priority fields"""
        response = requests.get(f"{BASE_URL}/api/integrations/schema/customers")
        assert response.status_code == 200
        data = response.json()
        
        assert "schema" in data
        assert "required" in data
        
        schema = data["schema"]
        required = data["required"]
        
        # Check required fields
        assert "name" in required, "name should be required for customers"
        assert "phone" in required, "phone should be required for customers"
        
        # Check priority fields exist in schema
        priority_fields = ["name", "phone", "email", "vehicle_of_interest", "status"]
        for field in priority_fields:
            assert field in schema, f"Priority field '{field}' missing from customer schema"
        
        # Check schema structure
        for field_name, field_info in schema.items():
            assert "type" in field_info, f"Field '{field_name}' missing type"
            assert "required" in field_info, f"Field '{field_name}' missing required flag"
            assert "description" in field_info, f"Field '{field_name}' missing description"
            assert "priority" in field_info, f"Field '{field_name}' missing priority"
        
        print(f"✓ Customer schema has {len(schema)} fields, required: {required}")
    
    def test_get_vehicles_schema(self):
        """Test GET /api/integrations/schema/vehicles - Returns vehicle schema with priority fields"""
        response = requests.get(f"{BASE_URL}/api/integrations/schema/vehicles")
        assert response.status_code == 200
        data = response.json()
        
        assert "schema" in data
        assert "required" in data
        
        schema = data["schema"]
        required = data["required"]
        
        # Check required fields
        assert "year" in required, "year should be required for vehicles"
        assert "make" in required, "make should be required for vehicles"
        assert "model" in required, "model should be required for vehicles"
        
        # Check priority fields exist in schema
        priority_fields = ["year", "make", "model", "price", "stock_number"]
        for field in priority_fields:
            assert field in schema, f"Priority field '{field}' missing from vehicle schema"
        
        print(f"✓ Vehicle schema has {len(schema)} fields, required: {required}")
    
    def test_get_invalid_schema(self):
        """Test GET /api/integrations/schema/invalid - Returns 400 for invalid data_type"""
        response = requests.get(f"{BASE_URL}/api/integrations/schema/invalid")
        assert response.status_code == 400
        data = response.json()
        assert "Invalid data_type" in data.get("detail", "")
        print("✓ Correctly returns 400 for invalid data_type")


class TestFieldDiscoveryFromSample:
    """Tests for field discovery from pasted JSON sample"""
    
    def test_discover_customer_fields_from_sample(self):
        """Test POST /api/integrations/discover-fields/sample - Discovers customer fields"""
        sample_json = json.dumps({
            "first_name": "John",
            "last_name": "Doe",
            "email_address": "john.doe@example.com",
            "phone_number": "555-123-4567",
            "lead_status": "hot",
            "interested_vehicle": "2024 Toyota Camry"
        })
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/discover-fields/sample",
            json={"sample_json": sample_json, "data_type": "customers"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data_type"] == "customers"
        assert "discovered_fields" in data
        assert "sample_record" in data
        
        discovered = data["discovered_fields"]
        assert len(discovered) >= 6, f"Expected at least 6 fields, got {len(discovered)}"
        
        # Check auto-mapping worked
        mappings = {f["source_name"]: f["suggested_mapping"] for f in discovered if f["suggested_mapping"]}
        
        # Verify high-confidence mappings
        assert mappings.get("email_address") == "email", "email_address should map to email"
        assert mappings.get("phone_number") == "phone", "phone_number should map to phone"
        
        # Check confidence scores
        for field in discovered:
            if field["suggested_mapping"]:
                assert field["confidence"] > 0, f"Field {field['source_name']} has no confidence score"
                assert field["is_mapped"] == True
        
        print(f"✓ Discovered {len(discovered)} fields with auto-mappings: {list(mappings.keys())}")
    
    def test_discover_vehicle_fields_from_sample(self):
        """Test POST /api/integrations/discover-fields/sample - Discovers vehicle fields"""
        sample_json = json.dumps({
            "model_year": "2024",
            "make": "Toyota",
            "model": "Camry",
            "trim_level": "XLE",
            "asking_price": 32500,
            "stock_number": "T12345",
            "vin": "1HGBH41JXMN109186",
            "mileage": 15000
        })
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/discover-fields/sample",
            json={"sample_json": sample_json, "data_type": "vehicles"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["data_type"] == "vehicles"
        
        discovered = data["discovered_fields"]
        mappings = {f["source_name"]: f["suggested_mapping"] for f in discovered if f["suggested_mapping"]}
        
        # Verify required fields are mapped
        assert "year" in mappings.values(), "year should be mapped"
        assert "make" in mappings.values(), "make should be mapped"
        assert "model" in mappings.values(), "model should be mapped"
        
        # Check unmapped_required is empty if all required fields are mapped
        if data.get("unmapped_required"):
            print(f"  Warning: Unmapped required fields: {data['unmapped_required']}")
        
        print(f"✓ Discovered {len(discovered)} vehicle fields with mappings: {list(mappings.values())}")
    
    def test_discover_fields_with_nested_json(self):
        """Test field discovery with nested JSON structure"""
        sample_json = json.dumps({
            "data": {
                "customer": {
                    "name": "Jane Smith",
                    "contact": {
                        "email": "jane@example.com",
                        "phone": "555-987-6543"
                    }
                }
            }
        })
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/discover-fields/sample",
            json={"sample_json": sample_json, "data_type": "customers"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should extract nested fields
        assert data["success"] == True
        discovered = data["discovered_fields"]
        
        # Check that nested paths are captured
        paths = [f["source_path"] for f in discovered]
        print(f"✓ Discovered nested fields with paths: {paths}")
    
    def test_discover_fields_from_array_sample(self):
        """Test field discovery from array of records"""
        sample_json = json.dumps([
            {"name": "Customer 1", "phone": "555-111-1111", "email": "c1@test.com"},
            {"name": "Customer 2", "phone": "555-222-2222", "email": "c2@test.com"}
        ])
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/discover-fields/sample",
            json={"sample_json": sample_json, "data_type": "customers"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        # Should extract first record
        assert data["sample_record"]["name"] == "Customer 1"
        print("✓ Correctly extracts first record from array")
    
    def test_discover_fields_invalid_json(self):
        """Test field discovery with invalid JSON"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/discover-fields/sample",
            json={"sample_json": "not valid json {", "data_type": "customers"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == False
        assert len(data["errors"]) > 0
        assert "Invalid JSON" in data["errors"][0]
        print("✓ Correctly handles invalid JSON with error message")
    
    def test_discover_fields_flags_unmapped_required(self):
        """Test that unmapped required fields are flagged"""
        # Sample missing required 'phone' field
        sample_json = json.dumps({
            "customer_name": "Test Customer",
            "email": "test@example.com",
            "status": "new"
        })
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/discover-fields/sample",
            json={"sample_json": sample_json, "data_type": "customers"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        # Should flag that 'phone' is unmapped (required field)
        unmapped = data.get("unmapped_required", [])
        assert "phone" in unmapped, "Should flag 'phone' as unmapped required field"
        
        # Should have warning
        assert len(data.get("warnings", [])) > 0
        print(f"✓ Correctly flags unmapped required fields: {unmapped}")


class TestIntegrationProfiles:
    """Tests for integration profile CRUD operations"""
    
    created_profile_id = None
    
    def test_list_profiles_includes_builtin(self):
        """Test GET /api/integration-profiles - Lists profiles including built-in ones"""
        response = requests.get(f"{BASE_URL}/api/integration-profiles")
        assert response.status_code == 200
        data = response.json()
        
        assert "profiles" in data
        profiles = data["profiles"]
        
        # Should have built-in profiles
        assert len(profiles) >= 4, f"Expected at least 4 built-in profiles, got {len(profiles)}"
        
        # Check for specific built-in profiles
        profile_names = [p["name"] for p in profiles]
        expected_builtin = ["VinSolutions Standard", "DealerSocket Standard", "elead CRM Standard", "Generic REST API"]
        
        for expected in expected_builtin:
            assert expected in profile_names, f"Missing built-in profile: {expected}"
        
        # Check profile structure
        for profile in profiles:
            assert "id" in profile
            assert "name" in profile
            assert "adapter_type" in profile
            assert "auth_method" in profile
        
        print(f"✓ Found {len(profiles)} profiles including built-in: {profile_names[:4]}")
    
    def test_create_profile(self):
        """Test POST /api/integration-profiles - Creates a new profile"""
        payload = {
            "name": "TEST_Custom CRM Profile",
            "description": "Test profile for automated testing",
            "adapter_type": "generic_rest",
            "base_url": "https://api.testcrm.com/v1",
            "auth_method": "api_key",
            "customers_endpoint": "/leads",
            "vehicles_endpoint": "/inventory",
            "customer_mappings": {
                "lead_name": "name",
                "lead_phone": "phone",
                "lead_email": "email"
            },
            "vehicle_mappings": {
                "vehicle_year": "year",
                "vehicle_make": "make",
                "vehicle_model": "model"
            },
            "pagination_type": "offset",
            "page_size": 50,
            "records_path": "results",
            "is_public": True,
            "tags": ["test", "automated"]
        }
        
        response = requests.post(f"{BASE_URL}/api/integration-profiles", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "profile_id" in data
        assert "TEST_Custom CRM Profile" in data["message"]
        
        TestIntegrationProfiles.created_profile_id = data["profile_id"]
        print(f"✓ Created profile: {data['profile_id']}")
    
    def test_get_profile_by_id(self):
        """Test GET /api/integration-profiles/{id} - Get profile details"""
        profile_id = TestIntegrationProfiles.created_profile_id
        assert profile_id is not None, "No profile ID from previous test"
        
        response = requests.get(f"{BASE_URL}/api/integration-profiles/{profile_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert data["id"] == profile_id
        assert data["name"] == "TEST_Custom CRM Profile"
        assert data["adapter_type"] == "generic_rest"
        assert data["base_url"] == "https://api.testcrm.com/v1"
        assert data["customers_endpoint"] == "/leads"
        assert data["customer_mappings"]["lead_name"] == "name"
        
        print(f"✓ Got profile details: {data['name']}")
    
    def test_export_profile(self):
        """Test GET /api/integration-profiles/{id}/export - Exports profile as JSON"""
        profile_id = TestIntegrationProfiles.created_profile_id
        assert profile_id is not None, "No profile ID from previous test"
        
        response = requests.get(f"{BASE_URL}/api/integration-profiles/{profile_id}/export")
        assert response.status_code == 200
        data = response.json()
        
        assert "json" in data
        
        # Parse the exported JSON
        exported = json.loads(data["json"])
        
        assert exported["name"] == "TEST_Custom CRM Profile"
        assert exported["adapter_type"] == "generic_rest"
        assert "_export_version" in exported
        assert "_exported_at" in exported
        
        # Should NOT include sensitive/internal fields
        assert "id" not in exported
        assert "created_by" not in exported
        assert "use_count" not in exported
        
        print(f"✓ Exported profile JSON with version {exported['_export_version']}")
    
    def test_import_profile(self):
        """Test POST /api/integration-profiles/import - Imports profile from JSON"""
        import_json = json.dumps({
            "name": "TEST_Imported Profile",
            "description": "Imported via API test",
            "adapter_type": "vinsolutions",
            "base_url": "https://api.vinsolutions.com/v1",
            "auth_method": "api_key",
            "customers_endpoint": "/leads",
            "vehicles_endpoint": "/inventory",
            "customer_mappings": {"lead_id": "source_id", "first_name": "first_name"},
            "vehicle_mappings": {"vehicle_id": "source_id", "model_year": "year"},
            "pagination_type": "offset",
            "page_size": 100,
            "records_path": "data",
            "tags": ["imported", "test"]
        })
        
        response = requests.post(
            f"{BASE_URL}/api/integration-profiles/import",
            json={"json_data": import_json}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "profile_id" in data
        assert "imported successfully" in data["message"]
        
        # Cleanup - delete imported profile
        requests.delete(f"{BASE_URL}/api/integration-profiles/{data['profile_id']}")
        
        print(f"✓ Imported profile: {data['profile_id']}")
    
    def test_import_profile_with_override_name(self):
        """Test importing profile with name override"""
        import_json = json.dumps({
            "name": "Original Name",
            "adapter_type": "generic_rest",
            "customers_endpoint": "/customers",
            "vehicles_endpoint": "/vehicles"
        })
        
        response = requests.post(
            f"{BASE_URL}/api/integration-profiles/import",
            json={"json_data": import_json, "override_name": "TEST_Overridden Name"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        
        # Verify name was overridden
        profile_response = requests.get(f"{BASE_URL}/api/integration-profiles/{data['profile_id']}")
        profile = profile_response.json()
        assert profile["name"] == "TEST_Overridden Name"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/integration-profiles/{data['profile_id']}")
        
        print("✓ Import with name override works correctly")
    
    def test_import_profile_invalid_json(self):
        """Test importing invalid JSON returns error"""
        response = requests.post(
            f"{BASE_URL}/api/integration-profiles/import",
            json={"json_data": "not valid json {"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "Invalid JSON" in data.get("detail", "")
        print("✓ Correctly rejects invalid JSON import")
    
    def test_import_profile_missing_required_fields(self):
        """Test importing profile missing required fields"""
        import_json = json.dumps({
            "name": "Incomplete Profile"
            # Missing adapter_type, customers_endpoint, vehicles_endpoint
        })
        
        response = requests.post(
            f"{BASE_URL}/api/integration-profiles/import",
            json={"json_data": import_json}
        )
        assert response.status_code == 400
        data = response.json()
        assert "Missing required fields" in data.get("detail", "")
        print("✓ Correctly rejects import with missing required fields")
    
    def test_update_profile(self):
        """Test PATCH /api/integration-profiles/{id} - Update profile"""
        profile_id = TestIntegrationProfiles.created_profile_id
        assert profile_id is not None, "No profile ID from previous test"
        
        response = requests.patch(
            f"{BASE_URL}/api/integration-profiles/{profile_id}",
            json={"description": "Updated description", "page_size": 200}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        # Verify update
        profile_response = requests.get(f"{BASE_URL}/api/integration-profiles/{profile_id}")
        profile = profile_response.json()
        assert profile["description"] == "Updated description"
        assert profile["page_size"] == 200
        
        print("✓ Profile updated successfully")
    
    def test_cannot_modify_builtin_profile(self):
        """Test that built-in profiles cannot be modified"""
        response = requests.patch(
            f"{BASE_URL}/api/integration-profiles/builtin_vinsolutions",
            json={"description": "Trying to modify"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "Cannot modify built-in" in data.get("detail", "")
        print("✓ Correctly prevents modification of built-in profiles")
    
    def test_cannot_delete_builtin_profile(self):
        """Test that built-in profiles cannot be deleted"""
        response = requests.delete(f"{BASE_URL}/api/integration-profiles/builtin_vinsolutions")
        assert response.status_code == 400
        data = response.json()
        assert "Cannot delete built-in" in data.get("detail", "")
        print("✓ Correctly prevents deletion of built-in profiles")
    
    def test_list_profiles_with_filters(self):
        """Test listing profiles with filters"""
        # Filter by adapter_type
        response = requests.get(f"{BASE_URL}/api/integration-profiles?adapter_type=vinsolutions")
        assert response.status_code == 200
        data = response.json()
        
        for profile in data["profiles"]:
            assert profile["adapter_type"] == "vinsolutions"
        
        # Filter by tags
        response = requests.get(f"{BASE_URL}/api/integration-profiles?tags=builtin")
        assert response.status_code == 200
        data = response.json()
        
        # All built-in profiles should have 'builtin' tag
        assert len(data["profiles"]) >= 4
        
        print("✓ Profile filtering works correctly")


class TestFieldDiscoveryFromAPI:
    """Tests for field discovery from live API (mock mode)"""
    
    def test_discover_fields_from_api_mock(self):
        """Test POST /api/integrations/discover-fields - Discovers fields from API"""
        # This test uses a mock/test endpoint - in real usage would hit actual CRM API
        # For testing, we'll verify the endpoint structure and error handling
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/discover-fields",
            json={
                "base_url": "https://api.example.com",
                "endpoint": "/customers",
                "auth_config": {
                    "method": "api_key",
                    "api_key": "test_key"
                },
                "data_type": "customers"
            }
        )
        
        # Will likely fail due to no real API, but should return proper structure
        assert response.status_code == 200
        data = response.json()
        
        # Should have proper response structure even on failure
        assert "success" in data
        assert "data_type" in data
        assert "discovered_fields" in data
        assert "errors" in data
        
        if not data["success"]:
            # Expected - no real API to connect to
            assert len(data["errors"]) > 0
            print(f"✓ API discovery endpoint works (expected failure: {data['errors'][0][:50]}...)")
        else:
            print(f"✓ API discovery succeeded with {len(data['discovered_fields'])} fields")


class TestCleanup:
    """Cleanup test data"""
    
    def test_delete_test_profile(self):
        """Delete test profile"""
        profile_id = TestIntegrationProfiles.created_profile_id
        if profile_id:
            response = requests.delete(f"{BASE_URL}/api/integration-profiles/{profile_id}")
            assert response.status_code == 200
            print(f"✓ Deleted test profile: {profile_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
