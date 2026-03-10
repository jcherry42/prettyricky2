"""
License Fields Integration Tests - Iteration 2

Tests new license scanning accuracy improvements and license field persistence:
- CustomerCreate/CustomerUpdate models now include license fields
- LeadSource enum now includes license_scan
- license_image_url, license_number, license_dob, license_expiration, city, state, zip_code fields
- No regression on existing customer functionality

Focus: Backend API contract validation, field persistence, and validation logic.
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://automotive-vin-ocr.preview.emergentagent.com').rstrip('/')


class TestHealthAndBasics:
    """Verify basic endpoints still work (no regression)"""
    
    def test_health_endpoint(self):
        """GET /api/health - backend healthy"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✅ Health: {data['status']}")

    def test_customers_list_still_working(self):
        """GET /api/customers/list - still working (no regression)"""
        response = requests.get(f"{BASE_URL}/api/customers/list", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "customers" in data
        print(f"✅ Customers list: {len(data.get('customers', []))} customers")

    def test_vehicles_inventory_still_working(self):
        """GET /api/vehicles/inventory - still working (no regression)"""
        response = requests.get(f"{BASE_URL}/api/vehicles/inventory", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "vehicles" in data
        print(f"✅ Vehicles inventory: {data.get('counts', {})}")


class TestCustomerCreateWithLicenseFields:
    """Test POST /api/customers/create with new license fields"""
    
    created_customer_ids = []
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        """Cleanup test customers after each test"""
        yield
        for customer_id in self.created_customer_ids:
            try:
                requests.delete(f"{BASE_URL}/api/customers/{customer_id}", timeout=10)
                print(f"🧹 Cleaned up customer: {customer_id}")
            except Exception as e:
                print(f"⚠️ Cleanup failed for {customer_id}: {e}")
        self.created_customer_ids.clear()
    
    def test_create_customer_with_all_license_fields(self):
        """POST /api/customers/create with license_image_url, license_number, license_dob, license_expiration, city, state, zip_code"""
        payload = {
            "first_name": "TEST_License",
            "last_name": "FullFields",
            "phone": "555-0123",
            "email": "test_license@example.com",
            "address": "123 Test Street",
            "lead_source": "license_scan",  # New enum value
            "lead_status": "new",
            "license_image_url": "/api/uploads/license_test123.jpg",
            "license_number": "D123456789",
            "license_dob": "01/15/1990",
            "license_expiration": "06/30/2028",
            "city": "Los Angeles",
            "state": "CA",
            "zip_code": "90001"
        }
        
        response = requests.post(f"{BASE_URL}/api/customers/create", json=payload, timeout=15)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text[:500]}"
        
        data = response.json()
        assert data.get("success") == True, f"Expected success=True, got {data}"
        
        customer = data.get("customer", {})
        customer_id = customer.get("id")
        assert customer_id, "Customer ID not returned"
        self.created_customer_ids.append(customer_id)
        
        # Verify all license fields are present in response
        assert customer.get("license_image_url") == payload["license_image_url"], f"license_image_url mismatch: {customer.get('license_image_url')}"
        assert customer.get("license_number") == payload["license_number"], f"license_number mismatch: {customer.get('license_number')}"
        assert customer.get("license_dob") == payload["license_dob"], f"license_dob mismatch: {customer.get('license_dob')}"
        assert customer.get("license_expiration") == payload["license_expiration"], f"license_expiration mismatch: {customer.get('license_expiration')}"
        assert customer.get("city") == payload["city"], f"city mismatch: {customer.get('city')}"
        assert customer.get("state") == payload["state"], f"state mismatch: {customer.get('state')}"
        assert customer.get("zip_code") == payload["zip_code"], f"zip_code mismatch: {customer.get('zip_code')}"
        assert customer.get("lead_source") == "license_scan", f"lead_source mismatch: {customer.get('lead_source')}"
        
        print(f"✅ Created customer with all license fields: {customer_id}")
        
        # Now verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", timeout=10)
        assert get_response.status_code == 200, f"GET customer failed: {get_response.status_code}"
        
        fetched = get_response.json()
        assert fetched.get("license_image_url") == payload["license_image_url"]
        assert fetched.get("license_number") == payload["license_number"]
        assert fetched.get("license_dob") == payload["license_dob"]
        assert fetched.get("license_expiration") == payload["license_expiration"]
        assert fetched.get("city") == payload["city"]
        assert fetched.get("state") == payload["state"]
        assert fetched.get("zip_code") == payload["zip_code"]
        print(f"✅ Verified license fields persisted via GET: {customer_id}")

    def test_create_customer_with_lead_source_license_scan(self):
        """POST /api/customers/create with lead_source=license_scan"""
        payload = {
            "first_name": "TEST_LeadSource",
            "last_name": "LicenseScan",
            "phone": "555-0124",
            "lead_source": "license_scan"
        }
        
        response = requests.post(f"{BASE_URL}/api/customers/create", json=payload, timeout=15)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text[:500]}"
        
        data = response.json()
        customer = data.get("customer", {})
        customer_id = customer.get("id")
        self.created_customer_ids.append(customer_id)
        
        assert customer.get("lead_source") == "license_scan"
        print(f"✅ Created customer with lead_source=license_scan: {customer_id}")

    def test_create_customer_with_lead_source_walk_in_no_regression(self):
        """POST /api/customers/create with lead_source=walk_in - should still work (no regression)"""
        payload = {
            "first_name": "TEST_WalkIn",
            "last_name": "Customer",
            "phone": "555-0125",
            "lead_source": "walk_in"
        }
        
        response = requests.post(f"{BASE_URL}/api/customers/create", json=payload, timeout=15)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text[:500]}"
        
        data = response.json()
        customer = data.get("customer", {})
        customer_id = customer.get("id")
        self.created_customer_ids.append(customer_id)
        
        assert customer.get("lead_source") == "walk_in"
        print(f"✅ No regression: lead_source=walk_in still works: {customer_id}")

    def test_create_customer_without_license_fields_defaults(self):
        """POST /api/customers/create without license fields - should still work with defaults"""
        payload = {
            "first_name": "TEST_NoLicense",
            "last_name": "Fields",
            "phone": "555-0126"
        }
        
        response = requests.post(f"{BASE_URL}/api/customers/create", json=payload, timeout=15)
        assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text[:500]}"
        
        data = response.json()
        customer = data.get("customer", {})
        customer_id = customer.get("id")
        self.created_customer_ids.append(customer_id)
        
        # License fields should be None/null by default
        assert customer.get("license_image_url") is None
        assert customer.get("license_number") is None
        print(f"✅ Created customer without license fields (defaults work): {customer_id}")


class TestCustomerUpdateWithLicenseFields:
    """Test PATCH /api/customers/{id} with license field updates"""
    
    created_customer_ids = []
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        """Cleanup test customers after tests"""
        yield
        for customer_id in self.created_customer_ids:
            try:
                requests.delete(f"{BASE_URL}/api/customers/{customer_id}", timeout=10)
                print(f"🧹 Cleaned up customer: {customer_id}")
            except Exception as e:
                print(f"⚠️ Cleanup failed for {customer_id}: {e}")
        self.created_customer_ids.clear()
    
    def test_update_customer_license_image_url(self):
        """PATCH /api/customers/{id} with license_image_url update"""
        # First create a customer
        create_payload = {
            "first_name": "TEST_Update",
            "last_name": "LicenseImg",
            "phone": "555-0127"
        }
        create_response = requests.post(f"{BASE_URL}/api/customers/create", json=create_payload, timeout=15)
        assert create_response.status_code == 201
        customer_id = create_response.json().get("customer", {}).get("id")
        self.created_customer_ids.append(customer_id)
        
        # Update with license_image_url
        update_payload = {
            "license_image_url": "/api/uploads/updated_license.jpg"
        }
        patch_response = requests.patch(f"{BASE_URL}/api/customers/{customer_id}", json=update_payload, timeout=15)
        assert patch_response.status_code == 200, f"PATCH failed: {patch_response.status_code}: {patch_response.text[:500]}"
        
        patch_data = patch_response.json()
        assert patch_data.get("success") == True
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", timeout=10)
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched.get("license_image_url") == "/api/uploads/updated_license.jpg"
        print(f"✅ PATCH license_image_url works: {customer_id}")

    def test_update_customer_all_license_fields(self):
        """PATCH /api/customers/{id} with all license fields"""
        # Create customer
        create_payload = {
            "first_name": "TEST_UpdateAll",
            "last_name": "LicenseFields",
            "phone": "555-0128"
        }
        create_response = requests.post(f"{BASE_URL}/api/customers/create", json=create_payload, timeout=15)
        assert create_response.status_code == 201
        customer_id = create_response.json().get("customer", {}).get("id")
        self.created_customer_ids.append(customer_id)
        
        # Update all license fields
        update_payload = {
            "license_image_url": "/api/uploads/full_update.jpg",
            "license_number": "X987654321",
            "license_dob": "03/20/1985",
            "license_expiration": "12/31/2029",
            "city": "San Francisco",
            "state": "CA",
            "zip_code": "94102"
        }
        patch_response = requests.patch(f"{BASE_URL}/api/customers/{customer_id}", json=update_payload, timeout=15)
        assert patch_response.status_code == 200, f"PATCH failed: {patch_response.status_code}"
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", timeout=10)
        fetched = get_response.json()
        
        for field, value in update_payload.items():
            assert fetched.get(field) == value, f"{field} mismatch: expected {value}, got {fetched.get(field)}"
        
        print(f"✅ PATCH all license fields works: {customer_id}")


class TestCustomerGetWithLicenseFields:
    """Test GET /api/customers/{id} returns license fields"""
    
    created_customer_ids = []
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        yield
        for customer_id in self.created_customer_ids:
            try:
                requests.delete(f"{BASE_URL}/api/customers/{customer_id}", timeout=10)
            except Exception:
                pass
        self.created_customer_ids.clear()
    
    def test_get_customer_returns_license_fields(self):
        """GET /api/customers/{id} - should return license fields"""
        # Create with license fields
        create_payload = {
            "first_name": "TEST_GetFields",
            "last_name": "LicenseReturn",
            "phone": "555-0129",
            "license_image_url": "/api/uploads/get_test.jpg",
            "license_number": "GET12345",
            "license_dob": "07/04/1985",
            "license_expiration": "07/04/2030",
            "city": "Austin",
            "state": "TX",
            "zip_code": "78701"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/customers/create", json=create_payload, timeout=15)
        assert create_response.status_code == 201
        customer_id = create_response.json().get("customer", {}).get("id")
        self.created_customer_ids.append(customer_id)
        
        # GET and verify all fields present
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", timeout=10)
        assert get_response.status_code == 200
        fetched = get_response.json()
        
        assert fetched.get("license_image_url") == "/api/uploads/get_test.jpg"
        assert fetched.get("license_number") == "GET12345"
        assert fetched.get("license_dob") == "07/04/1985"
        assert fetched.get("license_expiration") == "07/04/2030"
        assert fetched.get("city") == "Austin"
        assert fetched.get("state") == "TX"
        assert fetched.get("zip_code") == "78701"
        
        print(f"✅ GET returns all license fields: {customer_id}")


class TestLicenseEndpoints:
    """Test license scanning endpoints"""
    
    def test_license_scan_direct_rejects_empty_image(self):
        """POST /api/license/scan-direct - validate it rejects empty images"""
        # Empty file
        files = {'image': ('empty.jpg', b'', 'image/jpeg')}
        response = requests.post(f"{BASE_URL}/api/license/scan-direct", files=files, timeout=15)
        assert response.status_code == 200  # Returns 200 with error in body
        data = response.json()
        assert data.get("success") == False
        assert "empty" in data.get("error", "").lower() or "error" in data
        print(f"✅ scan-direct rejects empty images: {data.get('error')}")

    def test_license_scan_direct_rejects_tiny_image(self):
        """POST /api/license/scan-direct - validate it rejects tiny images (<5KB)"""
        # Create a tiny image (less than 5KB threshold)
        tiny_image = b'\x89PNG\r\n\x1a\n' + b'\x00' * 1000  # ~1KB
        files = {'image': ('tiny.png', tiny_image, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/license/scan-direct", files=files, timeout=15)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == False
        assert data.get("confidence") == 0 or data.get("error") is not None
        print(f"✅ scan-direct rejects tiny images: {data.get('error', 'low confidence')}")

    def test_license_upload_basic_flow(self):
        """POST /api/license/upload - validate basic upload flow works"""
        # Create a valid-sized test image (>5KB but fake content)
        # Real image would need actual JPEG/PNG structure
        fake_image = b'\x89PNG\r\n\x1a\n' + os.urandom(10000)  # ~10KB
        files = {'image': ('test_upload.png', fake_image, 'image/png')}
        
        response = requests.post(f"{BASE_URL}/api/license/upload", files=files, timeout=15)
        # Should either succeed or fail gracefully (not 500)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        data = response.json()
        if response.status_code == 200 and data.get("success"):
            assert "image_url" in data
            print(f"✅ license/upload works: {data.get('image_url')}")
        else:
            # Graceful failure is also acceptable for fake image data
            print(f"✅ license/upload handles invalid image gracefully")


class TestCustomerDelete:
    """Test DELETE /api/customers/{id} - cleanup test data"""
    
    def test_delete_customer(self):
        """DELETE /api/customers/{id} - cleanup test data"""
        # Create a customer to delete
        create_payload = {
            "first_name": "TEST_Delete",
            "last_name": "Customer",
            "phone": "555-0199"
        }
        create_response = requests.post(f"{BASE_URL}/api/customers/create", json=create_payload, timeout=15)
        assert create_response.status_code == 201
        customer_id = create_response.json().get("customer", {}).get("id")
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/customers/{customer_id}", timeout=10)
        assert delete_response.status_code == 200, f"DELETE failed: {delete_response.status_code}"
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", timeout=10)
        assert get_response.status_code == 404, "Customer should not exist after delete"
        
        print(f"✅ DELETE customer works: {customer_id}")

    def test_delete_nonexistent_customer(self):
        """DELETE /api/customers/{id} - returns 404 for nonexistent"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/customers/{fake_id}", timeout=10)
        assert response.status_code == 404
        print(f"✅ DELETE returns 404 for nonexistent customer")


# Additional lead source enum tests
class TestLeadSourceEnum:
    """Verify all LeadSource enum values work"""
    
    created_customer_ids = []
    
    @pytest.fixture(autouse=True)
    def cleanup(self):
        yield
        for customer_id in self.created_customer_ids:
            try:
                requests.delete(f"{BASE_URL}/api/customers/{customer_id}", timeout=10)
            except Exception:
                pass
        self.created_customer_ids.clear()
    
    @pytest.mark.parametrize("lead_source", [
        "walk_in", "phone", "web", "referral", "email", 
        "social", "crm_import", "file_import", "license_scan", "manual"
    ])
    def test_all_lead_sources_accepted(self, lead_source):
        """POST /api/customers/create with various lead_source values"""
        payload = {
            "first_name": f"TEST_{lead_source}",
            "last_name": "SourceTest",
            "phone": "555-0000",
            "lead_source": lead_source
        }
        
        response = requests.post(f"{BASE_URL}/api/customers/create", json=payload, timeout=15)
        
        if response.status_code == 201:
            customer_id = response.json().get("customer", {}).get("id")
            self.created_customer_ids.append(customer_id)
            print(f"✅ lead_source={lead_source} accepted")
        else:
            # 422 is expected for invalid enum values
            print(f"❌ lead_source={lead_source} failed: {response.status_code}")
            assert False, f"lead_source={lead_source} should be accepted"
