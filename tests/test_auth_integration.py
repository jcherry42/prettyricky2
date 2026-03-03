"""
Test Authentication Integration for Supercharg'd PWA
Tests: Registration, Login, Skip functionality, Tower Talk AI, Translation, Customer List
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://crm-scanner-sync.preview.emergentagent.com').rstrip('/')


class TestHealthAndBasicEndpoints:
    """Basic health and API status tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"✅ Health check passed: {data['status']}")
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Closr API"
        assert "version" in data
        print(f"✅ API root: {data['message']} v{data['version']}")


class TestAuthRegistration:
    """User registration tests"""
    
    def test_register_new_user(self):
        """Test registering a new user"""
        unique_email = f"test_reg_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "email": unique_email,
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "User"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == unique_email.lower()
        assert data["user"]["first_name"] == "Test"
        assert data["user"]["last_name"] == "User"
        assert data["user"]["role"] == "sales_rep"
        assert "permissions" in data["user"]
        print(f"✅ Registration successful for: {unique_email}")
    
    def test_register_duplicate_email_fails(self):
        """Test that duplicate email registration fails"""
        unique_email = f"test_dup_{uuid.uuid4().hex[:8]}@test.com"
        payload = {
            "email": unique_email,
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "User"
        }
        
        # First registration should succeed
        response1 = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response1.status_code == 200
        
        # Second registration with same email should fail
        response2 = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response2.status_code == 400
        print("✅ Duplicate email registration correctly rejected")
    
    def test_register_invalid_email_fails(self):
        """Test that invalid email format fails"""
        payload = {
            "email": "invalid-email",
            "password": "TestPass123!",
            "first_name": "Test",
            "last_name": "User"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 422  # Validation error
        print("✅ Invalid email format correctly rejected")
    
    def test_register_short_password_fails(self):
        """Test that short password fails"""
        payload = {
            "email": f"test_{uuid.uuid4().hex[:8]}@test.com",
            "password": "short",
            "first_name": "Test",
            "last_name": "User"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 422  # Validation error
        print("✅ Short password correctly rejected")


class TestAuthLogin:
    """User login tests"""
    
    @pytest.fixture(autouse=True)
    def setup_test_user(self):
        """Create a test user for login tests"""
        self.test_email = f"test_login_{uuid.uuid4().hex[:8]}@test.com"
        self.test_password = "TestPass123!"
        
        payload = {
            "email": self.test_email,
            "password": self.test_password,
            "first_name": "Login",
            "last_name": "Test"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert response.status_code == 200
    
    def test_login_success(self):
        """Test successful login"""
        payload = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 1800
        assert "user" in data
        assert data["user"]["email"] == self.test_email.lower()
        print(f"✅ Login successful for: {self.test_email}")
    
    def test_login_demo_user(self):
        """Test login with demo credentials"""
        payload = {
            "email": "demo@superchargd.com",
            "password": "DemoPass123!"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "demo@superchargd.com"
        print("✅ Demo user login successful")
    
    def test_login_invalid_password_fails(self):
        """Test login with wrong password fails"""
        payload = {
            "email": self.test_email,
            "password": "WrongPassword123!"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 401
        print("✅ Invalid password correctly rejected")
    
    def test_login_nonexistent_user_fails(self):
        """Test login with non-existent user fails"""
        payload = {
            "email": "nonexistent@test.com",
            "password": "TestPass123!"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 401
        print("✅ Non-existent user login correctly rejected")


class TestAuthMe:
    """Test /api/auth/me endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup_authenticated_user(self):
        """Create and login a test user"""
        self.test_email = f"test_me_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register
        reg_payload = {
            "email": self.test_email,
            "password": "TestPass123!",
            "first_name": "Me",
            "last_name": "Test"
        }
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json=reg_payload)
        assert reg_response.status_code == 200
        
        data = reg_response.json()
        self.token = data["access_token"]
        self.user_id = data["user"]["user_id"]
    
    def test_get_current_user(self):
        """Test getting current user info"""
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["user_id"] == self.user_id
        assert data["email"] == self.test_email.lower()
        assert data["first_name"] == "Me"
        assert data["last_name"] == "Test"
        assert data["role"] == "sales_rep"
        assert "permissions" in data
        print(f"✅ Get current user successful: {data['email']}")
    
    def test_get_current_user_invalid_token_fails(self):
        """Test that invalid token fails"""
        headers = {"Authorization": "Bearer invalid_token"}
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 401
        print("✅ Invalid token correctly rejected")
    
    def test_get_current_user_no_token_fails(self):
        """Test that missing token fails"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 403  # No credentials provided
        print("✅ Missing token correctly rejected")


class TestTowerTalkAI:
    """Test Tower Talk AI message generation"""
    
    def test_tower_talk_generates_message(self):
        """Test Tower Talk generates a sales message"""
        payload = {
            "situation": "Customer interested in a new car",
            "context": {
                "customerName": "John Smith",
                "vehicle": "2024 Toyota Camry",
                "vehiclePrice": "$35,000",
                "dealershipName": "ABC Motors",
                "salespersonName": "Mike",
                "salespersonStyle": "friendly"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/tower-talk", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "response" in data
        assert len(data["response"]) > 0
        # Check that the response mentions the customer or vehicle
        response_lower = data["response"].lower()
        assert "john" in response_lower or "camry" in response_lower or "mike" in response_lower
        print(f"✅ Tower Talk generated message: {data['response'][:100]}...")
    
    def test_tower_talk_different_styles(self):
        """Test Tower Talk with different salesperson styles"""
        styles = ["straight_shooter", "friendly", "professional"]
        
        for style in styles:
            payload = {
                "situation": "Follow up on test drive",
                "context": {
                    "customerName": "Jane Doe",
                    "vehicle": "2024 Honda Accord",
                    "dealershipName": "Test Motors",
                    "salespersonName": "Sarah",
                    "salespersonStyle": style
                }
            }
            
            response = requests.post(f"{BASE_URL}/api/tower-talk", json=payload)
            assert response.status_code == 200
            data = response.json()
            assert "response" in data
            assert len(data["response"]) > 0
            print(f"✅ Tower Talk with style '{style}' generated message")


class TestTranslationAPI:
    """Test translation endpoint"""
    
    def test_translate_english_to_spanish(self):
        """Test English to Spanish translation"""
        payload = {
            "text": "Hello, how are you?",
            "source_lang": "en",
            "target_lang": "es"
        }
        
        response = requests.post(f"{BASE_URL}/api/translate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "translated_text" in data
        assert len(data["translated_text"]) > 0
        # Check for Spanish characters or common words
        assert "hola" in data["translated_text"].lower() or "cómo" in data["translated_text"].lower()
        assert data["detected_lang"] == "en"
        assert data["confidence"] > 0.8
        print(f"✅ Translation: '{payload['text']}' -> '{data['translated_text']}'")
    
    def test_translate_auto_detect(self):
        """Test auto language detection"""
        payload = {
            "text": "Hola, ¿cómo estás?",
            "source_lang": "auto",
            "target_lang": "en"
        }
        
        response = requests.post(f"{BASE_URL}/api/translate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "translated_text" in data
        assert data["detected_lang"] == "es"
        print(f"✅ Auto-detect translation: detected '{data['detected_lang']}'")
    
    def test_translate_empty_text(self):
        """Test translation with empty text"""
        payload = {
            "text": "",
            "source_lang": "en",
            "target_lang": "es"
        }
        
        response = requests.post(f"{BASE_URL}/api/translate", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["translated_text"] == ""
        print("✅ Empty text translation handled correctly")


class TestCustomerListAPI:
    """Test customer list endpoint"""
    
    def test_get_customers(self):
        """Test getting customer list"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        
        data = response.json()
        assert "customers" in data
        assert "count" in data
        assert isinstance(data["customers"], list)
        assert data["count"] >= 0
        
        if data["count"] > 0:
            customer = data["customers"][0]
            assert "id" in customer
            assert "name" in customer
            print(f"✅ Got {data['count']} customers")
        else:
            print("✅ Customer list returned (empty)")
    
    def test_get_customers_with_search(self):
        """Test customer search"""
        response = requests.get(f"{BASE_URL}/api/customers?search=John")
        assert response.status_code == 200
        
        data = response.json()
        assert "customers" in data
        print(f"✅ Customer search returned {data['count']} results")
    
    def test_get_customers_with_limit(self):
        """Test customer list with limit"""
        response = requests.get(f"{BASE_URL}/api/customers?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["customers"]) <= 5
        print(f"✅ Customer list with limit returned {len(data['customers'])} results")


class TestVehicleListAPI:
    """Test vehicle list endpoint"""
    
    def test_get_vehicles(self):
        """Test getting vehicle list"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 200
        
        data = response.json()
        assert "vehicles" in data
        assert "count" in data
        assert isinstance(data["vehicles"], list)
        print(f"✅ Got {data['count']} vehicles")


class TestDashboardStats:
    """Test dashboard stats endpoint"""
    
    def test_get_dashboard_stats(self):
        """Test getting dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "customers" in data
        assert "vehicles" in data
        print(f"✅ Dashboard stats: {data['customers']['total']} customers, {data['vehicles']['total']} vehicles")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
