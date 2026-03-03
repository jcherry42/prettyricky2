"""
Test License OCR Scan Feature
Tests the new /api/license/scan endpoint with OCR extraction
and /api/license/create-customer endpoint
"""
import pytest
import requests
import os
import io
import base64
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://customer-modal-v2.preview.emergentagent.com').rstrip('/')


class TestLicenseScanOCR:
    """Test the new OCR license scan endpoint"""
    
    @pytest.fixture
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture
    def test_image_bytes(self):
        """Create a simple test image (PNG)"""
        img = Image.new('RGB', (400, 250), color=(255, 255, 255))
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer.getvalue()
    
    @pytest.fixture
    def test_jpeg_bytes(self):
        """Create a simple test JPEG image"""
        img = Image.new('RGB', (400, 250), color=(200, 200, 200))
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        buffer.seek(0)
        return buffer.getvalue()
    
    def test_health_check(self, api_client):
        """Test health endpoint is working"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✅ Health check passed")
    
    def test_license_scan_endpoint_exists(self, api_client, test_image_bytes):
        """Test that /api/license/scan endpoint exists and accepts images"""
        files = {'image': ('test_license.png', test_image_bytes, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        
        # Should return 200 (success) or error from OCR, not 404
        assert response.status_code != 404, "Endpoint /api/license/scan not found"
        print(f"✅ License scan endpoint exists, status: {response.status_code}")
        
        # Check response structure
        data = response.json()
        assert "success" in data, "Response should have 'success' field"
        print(f"   Response: success={data.get('success')}")
    
    def test_license_scan_returns_image_url(self, api_client, test_image_bytes):
        """Test that license scan saves image and returns URL"""
        files = {'image': ('test_license.png', test_image_bytes, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        
        assert response.status_code == 200
        data = response.json()
        
        # Even if OCR fails, image should be saved
        if data.get('image_url'):
            assert data['image_url'].startswith('/api/uploads/')
            print(f"✅ Image saved at: {data['image_url']}")
            
            # Verify image is accessible
            img_response = requests.get(f"{BASE_URL}{data['image_url']}")
            assert img_response.status_code == 200
            print("✅ Image is accessible")
        else:
            print("⚠️ No image_url in response (OCR may have failed early)")
    
    def test_license_scan_with_jpeg(self, api_client, test_jpeg_bytes):
        """Test license scan with JPEG image"""
        files = {'image': ('test_license.jpg', test_jpeg_bytes, 'image/jpeg')}
        response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"✅ JPEG upload accepted, success={data.get('success')}")
    
    def test_license_scan_invalid_file_type(self, api_client):
        """Test license scan rejects invalid file types"""
        files = {'image': ('test.txt', b'not an image', 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        
        data = response.json()
        assert data.get('success') is False
        assert 'error' in data
        print(f"✅ Invalid file type rejected: {data.get('error')}")
    
    def test_license_scan_empty_file(self, api_client):
        """Test license scan handles empty file"""
        files = {'image': ('empty.png', b'', 'image/png')}
        response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        
        data = response.json()
        assert data.get('success') is False
        print(f"✅ Empty file handled: {data.get('error')}")
    
    def test_license_scan_response_structure(self, api_client, test_image_bytes):
        """Test that license scan response has correct structure"""
        files = {'image': ('test_license.png', test_image_bytes, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields exist
        assert 'success' in data
        
        # If successful, should have extracted_data and image_url
        if data.get('success'):
            assert 'extracted_data' in data, "Successful scan should have extracted_data"
            assert 'image_url' in data, "Successful scan should have image_url"
            
            extracted = data.get('extracted_data', {})
            print(f"✅ Extracted data fields: {list(extracted.keys())}")
            
            # Check expected fields in extracted_data
            expected_fields = ['first_name', 'last_name', 'address', 'city', 'state', 'zip_code']
            for field in expected_fields:
                if field in extracted:
                    print(f"   {field}: {extracted[field]}")
        else:
            # If failed, should have error
            assert 'error' in data, "Failed scan should have error message"
            print(f"⚠️ OCR extraction failed (expected with test image): {data.get('error')}")


class TestCreateCustomerFromLicense:
    """Test the /api/license/create-customer endpoint"""
    
    @pytest.fixture
    def test_image_bytes(self):
        """Create a simple test image (PNG)"""
        img = Image.new('RGB', (400, 250), color=(255, 255, 255))
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer.getvalue()
    
    def test_create_customer_endpoint_exists(self):
        """Test that /api/license/create-customer endpoint exists"""
        form_data = {
            'first_name': (None, 'TEST_John'),
            'last_name': (None, 'TEST_Doe'),
            'address': (None, '123 Test St'),
            'city': (None, 'Test City'),
            'state': (None, 'CA'),
            'zip_code': (None, '90210'),
            'image_url': (None, '/api/uploads/test.png')
        }
        response = requests.post(f"{BASE_URL}/api/license/create-customer", files=form_data)
        
        assert response.status_code != 404, "Endpoint /api/license/create-customer not found"
        print(f"✅ Create customer endpoint exists, status: {response.status_code}")
    
    def test_create_customer_with_extracted_data(self, test_image_bytes):
        """Test creating customer from extracted license data"""
        # First upload an image to get a valid image_url
        files = {'image': ('test_license.png', test_image_bytes, 'image/png')}
        upload_response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        
        image_url = upload_response.json().get('image_url', '/api/uploads/test.png')
        
        # Create customer with extracted data - use files dict for multipart form
        form_data = {
            'first_name': (None, 'TEST_Jane'),
            'last_name': (None, 'TEST_Smith'),
            'address': (None, '456 Oak Ave'),
            'city': (None, 'Los Angeles'),
            'state': (None, 'CA'),
            'zip_code': (None, '90001'),
            'image_url': (None, image_url)
        }
        response = requests.post(f"{BASE_URL}/api/license/create-customer", files=form_data)
        
        assert response.status_code == 200
        result = response.json()
        
        assert result.get('success') is True
        assert 'customer' in result
        
        customer = result['customer']
        assert customer['first_name'] == 'TEST_Jane'
        assert customer['last_name'] == 'TEST_Smith'
        assert customer['name'] == 'TEST_Jane TEST_Smith'
        assert customer['license_image_url'] == image_url
        assert customer['lead_source'] == 'license_scan'
        
        print(f"✅ Customer created: {customer['name']}")
        print(f"   ID: {customer['id']}")
        print(f"   Address: {customer.get('address')}")
        print(f"   License image: {customer.get('license_image_url')}")
        
        # Verify customer exists in database
        customers_response = requests.get(f"{BASE_URL}/api/customers?search=TEST_Jane")
        assert customers_response.status_code == 200
        customers = customers_response.json().get('customers', [])
        assert len(customers) > 0, "Customer should be found in database"
        print("✅ Customer verified in database")
    
    def test_create_customer_missing_required_fields(self):
        """Test that create customer requires first_name, last_name, image_url"""
        # Missing first_name
        form_data = {
            'last_name': (None, 'TEST_Missing'),
            'image_url': (None, '/api/uploads/test.png')
        }
        response = requests.post(f"{BASE_URL}/api/license/create-customer", files=form_data)
        assert response.status_code == 422, "Should require first_name"
        print("✅ Missing first_name rejected")
        
        # Missing last_name
        form_data = {
            'first_name': (None, 'TEST_Missing'),
            'image_url': (None, '/api/uploads/test.png')
        }
        response = requests.post(f"{BASE_URL}/api/license/create-customer", files=form_data)
        assert response.status_code == 422, "Should require last_name"
        print("✅ Missing last_name rejected")
        
        # Missing image_url
        form_data = {
            'first_name': (None, 'TEST_Missing'),
            'last_name': (None, 'TEST_Missing')
        }
        response = requests.post(f"{BASE_URL}/api/license/create-customer", files=form_data)
        assert response.status_code == 422, "Should require image_url"
        print("✅ Missing image_url rejected")
    
    def test_create_customer_partial_address(self, test_image_bytes):
        """Test creating customer with partial address info"""
        files = {'image': ('test_license.png', test_image_bytes, 'image/png')}
        upload_response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        image_url = upload_response.json().get('image_url', '/api/uploads/test.png')
        
        # Only first_name, last_name, and image_url (no address)
        form_data = {
            'first_name': (None, 'TEST_NoAddress'),
            'last_name': (None, 'TEST_Customer'),
            'image_url': (None, image_url)
        }
        response = requests.post(f"{BASE_URL}/api/license/create-customer", files=form_data)
        
        assert response.status_code == 200
        result = response.json()
        assert result.get('success') is True
        
        customer = result['customer']
        assert customer['first_name'] == 'TEST_NoAddress'
        assert customer['address'] == ''  # Empty address
        print(f"✅ Customer created without address: {customer['name']}")


class TestLicenseAttach:
    """Test the /api/license/attach endpoint"""
    
    @pytest.fixture
    def test_image_bytes(self):
        """Create a simple test image (PNG)"""
        img = Image.new('RGB', (400, 250), color=(255, 255, 255))
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer.getvalue()
    
    def test_attach_license_to_existing_customer(self, test_image_bytes):
        """Test attaching license to existing customer"""
        # First create a customer
        files = {'image': ('test_license.png', test_image_bytes, 'image/png')}
        upload_response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        image_url = upload_response.json().get('image_url', '/api/uploads/test.png')
        
        create_form = {
            'first_name': (None, 'TEST_Attach'),
            'last_name': (None, 'TEST_Customer'),
            'image_url': (None, image_url)
        }
        create_response = requests.post(f"{BASE_URL}/api/license/create-customer", files=create_form)
        customer_id = create_response.json().get('customer', {}).get('id')
        
        assert customer_id, "Customer should be created"
        
        # Upload a new license image
        new_files = {'image': ('new_license.png', test_image_bytes, 'image/png')}
        new_upload = requests.post(f"{BASE_URL}/api/license/scan", files=new_files)
        new_image_url = new_upload.json().get('image_url')
        
        # Attach new license to customer - use multipart form
        attach_form = {
            'customer_id': (None, customer_id),
            'image_url': (None, new_image_url)
        }
        attach_response = requests.post(f"{BASE_URL}/api/license/attach", files=attach_form)
        
        assert attach_response.status_code == 200
        result = attach_response.json()
        assert result.get('success') is True
        assert result.get('license_image_url') == new_image_url
        print(f"✅ License attached to customer: {result.get('customer_name')}")
    
    def test_attach_license_invalid_customer(self, test_image_bytes):
        """Test attaching license to non-existent customer"""
        files = {'image': ('test_license.png', test_image_bytes, 'image/png')}
        upload_response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        image_url = upload_response.json().get('image_url', '/api/uploads/test.png')
        
        attach_form = {
            'customer_id': (None, 'nonexistent-customer-id-12345'),
            'image_url': (None, image_url)
        }
        attach_response = requests.post(f"{BASE_URL}/api/license/attach", files=attach_form)
        
        assert attach_response.status_code == 404
        print("✅ Invalid customer ID rejected with 404")


class TestLicenseUploadSimple:
    """Test the simple /api/license/upload endpoint (no OCR)"""
    
    @pytest.fixture
    def test_image_bytes(self):
        """Create a simple test image (PNG)"""
        img = Image.new('RGB', (400, 250), color=(255, 255, 255))
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        return buffer.getvalue()
    
    def test_simple_upload_still_works(self, test_image_bytes):
        """Test that simple upload without OCR still works"""
        files = {'image': ('test_license.png', test_image_bytes, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/license/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data.get('success') is True
        assert 'image_url' in data
        print(f"✅ Simple upload works: {data.get('image_url')}")
    
    def test_simple_upload_with_customer_id(self, test_image_bytes):
        """Test simple upload with customer_id attaches to customer"""
        # First create a customer
        files = {'image': ('test_license.png', test_image_bytes, 'image/png')}
        upload_response = requests.post(f"{BASE_URL}/api/license/scan", files=files)
        image_url = upload_response.json().get('image_url', '/api/uploads/test.png')
        
        create_form = {
            'first_name': (None, 'TEST_SimpleUpload'),
            'last_name': (None, 'TEST_Customer'),
            'image_url': (None, image_url)
        }
        create_response = requests.post(f"{BASE_URL}/api/license/create-customer", files=create_form)
        customer_id = create_response.json().get('customer', {}).get('id')
        
        # Upload with customer_id - combine file and form data
        files = {
            'image': ('test_license.png', test_image_bytes, 'image/png'),
            'customer_id': (None, customer_id)
        }
        response = requests.post(f"{BASE_URL}/api/license/upload", files=files)
        
        assert response.status_code == 200
        result = response.json()
        assert result.get('success') is True
        assert result.get('customer_id') == customer_id
        print("✅ Simple upload with customer_id works")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_customers(self):
        """Remove TEST_ prefixed customers"""
        response = requests.get(f"{BASE_URL}/api/customers?search=TEST_")
        if response.status_code == 200:
            customers = response.json().get('customers', [])
            deleted = 0
            for customer in customers:
                if customer.get('name', '').startswith('TEST_') or \
                   customer.get('firstName', '').startswith('TEST_') or \
                   customer.get('first_name', '').startswith('TEST_'):
                    del_response = requests.delete(f"{BASE_URL}/api/customers/{customer['id']}")
                    if del_response.status_code in [200, 204]:
                        deleted += 1
            print(f"✅ Cleaned up {deleted} test customers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
