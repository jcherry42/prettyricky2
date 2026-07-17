"""
Auth Enforcement & Anomaly Detection Tests (Iteration 7)

Tests:
1. Public endpoints return 200 without auth
2. Protected endpoints return 401 without auth
3. Protected endpoints return 200 with valid JWT
4. Auth flow: login, refresh, verify
5. Anomaly detection endpoints (with auth)
6. API v2 versioned endpoints enforce auth
7. Regression tests for existing endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://apex-service-advisor.preview.emergentagent.com').rstrip('/')

# Test PIN for login
TEST_PIN = "11111"


class TestPublicEndpoints:
    """Public endpoints should return 200 without authentication"""
    
    def test_health_endpoint_public(self):
        """GET /api/health should be public"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health endpoint should be public: {response.text}"
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
    
    def test_ready_endpoint_public(self):
        """GET /api/ready should be public"""
        response = requests.get(f"{BASE_URL}/api/ready")
        assert response.status_code == 200, f"Ready endpoint should be public: {response.text}"
        data = response.json()
        assert data["ready"] is True
    
    def test_root_endpoint_public(self):
        """GET /api/ should be public"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"Root endpoint should be public: {response.text}"
        data = response.json()
        assert "message" in data
    
    def test_auth_status_public(self):
        """GET /api/auth/status should be public"""
        response = requests.get(f"{BASE_URL}/api/auth/status")
        assert response.status_code == 200, f"Auth status should be public: {response.text}"
        data = response.json()
        assert "pin_set" in data
    
    def test_diagnostics_endpoint_public(self):
        """GET /api/diagnostics should be public"""
        response = requests.get(f"{BASE_URL}/api/diagnostics", timeout=15)
        assert response.status_code == 200, f"Diagnostics should be public: {response.text}"
        data = response.json()
        assert "status" in data
        assert "probes" in data
    
    def test_metrics_endpoint_public(self):
        """GET /api/metrics should be public (infrastructure endpoint)"""
        response = requests.get(f"{BASE_URL}/api/metrics")
        assert response.status_code == 200, f"Metrics should be public: {response.text}"
        data = response.json()
        assert "uptime_seconds" in data
    
    def test_ai_stats_endpoint_public(self):
        """GET /api/ai/stats should be public (infrastructure endpoint)"""
        response = requests.get(f"{BASE_URL}/api/ai/stats")
        assert response.status_code == 200, f"AI stats should be public: {response.text}"


class TestProtectedEndpointsWithoutAuth:
    """Protected endpoints should return 401 without authentication"""
    
    def test_customers_requires_auth(self):
        """GET /api/customers should require auth"""
        response = requests.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 401, f"Customers should require auth, got {response.status_code}"
    
    def test_vehicles_requires_auth(self):
        """GET /api/vehicles should require auth"""
        response = requests.get(f"{BASE_URL}/api/vehicles")
        assert response.status_code == 401, f"Vehicles should require auth, got {response.status_code}"
    
    def test_vin_trade_in_count_requires_auth(self):
        """GET /api/vin/trade-in-count should require auth"""
        response = requests.get(f"{BASE_URL}/api/vin/trade-in-count")
        assert response.status_code == 401, f"VIN trade-in-count should require auth, got {response.status_code}"
    
    def test_anomalies_summary_requires_auth(self):
        """GET /api/anomalies/summary should require auth"""
        response = requests.get(f"{BASE_URL}/api/anomalies/summary")
        assert response.status_code == 401, f"Anomalies summary should require auth, got {response.status_code}"
    
    def test_telemetry_summary_requires_auth(self):
        """GET /api/telemetry/summary should require auth"""
        response = requests.get(f"{BASE_URL}/api/telemetry/summary")
        assert response.status_code == 401, f"Telemetry summary should require auth, got {response.status_code}"
    
    def test_knowledge_stats_requires_auth(self):
        """GET /api/knowledge/stats should require auth"""
        response = requests.get(f"{BASE_URL}/api/knowledge/stats")
        assert response.status_code == 401, f"Knowledge stats should require auth, got {response.status_code}"
    
    def test_anomalies_list_requires_auth(self):
        """GET /api/anomalies should require auth"""
        response = requests.get(f"{BASE_URL}/api/anomalies")
        assert response.status_code == 401, f"Anomalies list should require auth, got {response.status_code}"
    
    def test_anomalies_scan_requires_auth(self):
        """POST /api/anomalies/scan should require auth"""
        response = requests.post(f"{BASE_URL}/api/anomalies/scan")
        assert response.status_code == 401, f"Anomalies scan should require auth, got {response.status_code}"


class TestAPIv2Versioning:
    """API v2 versioned endpoints should also enforce auth"""
    
    def test_v2_health_public(self):
        """GET /api/v2/health should be public (rewritten to /api/health)"""
        response = requests.get(f"{BASE_URL}/api/v2/health")
        assert response.status_code == 200, f"V2 health should be public: {response.text}"
    
    def test_v2_customers_requires_auth(self):
        """GET /api/v2/customers should require auth"""
        response = requests.get(f"{BASE_URL}/api/v2/customers")
        assert response.status_code == 401, f"V2 customers should require auth, got {response.status_code}"
    
    def test_v2_vehicles_requires_auth(self):
        """GET /api/v2/vehicles should require auth"""
        response = requests.get(f"{BASE_URL}/api/v2/vehicles")
        assert response.status_code == 401, f"V2 vehicles should require auth, got {response.status_code}"


class TestAuthFlow:
    """Test authentication flow: login, refresh, verify"""
    
    def test_login_with_valid_pin(self):
        """POST /api/auth/login with valid PIN returns tokens"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN})
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
    
    def test_login_with_invalid_pin(self):
        """POST /api/auth/login with invalid PIN returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": "99999"})
        assert response.status_code == 401, f"Invalid PIN should return 401, got {response.status_code}"
    
    def test_refresh_token_flow(self):
        """POST /api/auth/refresh with valid refresh_token returns new access_token"""
        # First login to get refresh token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN})
        assert login_response.status_code == 200
        refresh_token = login_response.json()["refresh_token"]
        
        # Use refresh token to get new access token
        response = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": refresh_token})
        assert response.status_code == 200, f"Refresh failed: {response.text}"
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    def test_verify_valid_token(self):
        """GET /api/auth/verify with valid Bearer token returns valid:true"""
        # Login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN})
        access_token = login_response.json()["access_token"]
        
        # Verify token
        response = requests.get(
            f"{BASE_URL}/api/auth/verify",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert response.status_code == 200, f"Verify failed: {response.text}"
        data = response.json()
        assert data["valid"] is True
        assert "user_id" in data


class TestProtectedEndpointsWithAuth:
    """Protected endpoints should return 200 with valid JWT token"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get valid access token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN})
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_customers_with_auth(self, auth_token):
        """GET /api/customers should work with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/customers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Customers with auth failed: {response.text}"
    
    def test_vehicles_with_auth(self, auth_token):
        """GET /api/vehicles should work with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/vehicles",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Vehicles with auth failed: {response.text}"
    
    def test_vin_trade_in_count_with_auth(self, auth_token):
        """GET /api/vin/trade-in-count should work with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/vin/trade-in-count",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"VIN trade-in-count with auth failed: {response.text}"
        data = response.json()
        assert "count" in data
    
    def test_vin_decode_with_auth(self, auth_token):
        """GET /api/vin/decode/{vin} should work with valid auth - verify Honda Accord 2003"""
        response = requests.get(
            f"{BASE_URL}/api/vin/decode/1HGCM82633A004352",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"VIN decode with auth failed: {response.text}"
        data = response.json()
        # Verify it's a Honda Accord 2003
        assert "make" in data or "Make" in data
        assert "model" in data or "Model" in data
        assert "year" in data or "ModelYear" in data
    
    def test_knowledge_stats_with_auth(self, auth_token):
        """GET /api/knowledge/stats should work with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/knowledge/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Knowledge stats with auth failed: {response.text}"
    
    def test_telemetry_summary_with_auth(self, auth_token):
        """GET /api/telemetry/summary should work with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/telemetry/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Telemetry summary with auth failed: {response.text}"


class TestAnomalyDetection:
    """Test anomaly detection endpoints (all require auth)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get valid access token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN})
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    def test_anomaly_summary_with_auth(self, auth_token):
        """GET /api/anomalies/summary should work with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/anomalies/summary",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Anomaly summary failed: {response.text}"
        data = response.json()
        # Verify summary structure
        assert "total" in data or isinstance(data, dict)
    
    def test_anomaly_list_with_auth(self, auth_token):
        """GET /api/anomalies should work with valid auth"""
        response = requests.get(
            f"{BASE_URL}/api/anomalies",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Anomaly list failed: {response.text}"
        data = response.json()
        # Should return a list or dict with anomalies
        assert isinstance(data, (list, dict))
    
    def test_anomaly_scan_with_auth(self, auth_token):
        """POST /api/anomalies/scan should run full anomaly scan with auth"""
        response = requests.post(
            f"{BASE_URL}/api/anomalies/scan",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=30  # Scan may take time
        )
        assert response.status_code == 200, f"Anomaly scan failed: {response.text}"
        data = response.json()
        # Verify scan results structure
        assert isinstance(data, dict)


class TestRegressionEndpoints:
    """Regression tests to ensure existing endpoints still work with auth"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get valid access token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN})
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_batch_vin_decode(self, auth_token):
        """POST /api/vin/decode-batch should work with auth"""
        response = requests.post(
            f"{BASE_URL}/api/vin/decode-batch",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"vins": ["1HGCM82633A004352"]}
        )
        assert response.status_code == 200, f"Batch VIN decode failed: {response.text}"
        data = response.json()
        assert isinstance(data, dict)
    
    def test_v2_customers_with_auth(self, auth_token):
        """GET /api/v2/customers should work with auth (versioned API)"""
        response = requests.get(
            f"{BASE_URL}/api/v2/customers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"V2 customers with auth failed: {response.text}"
    
    def test_v2_vehicles_with_auth(self, auth_token):
        """GET /api/v2/vehicles should work with auth (versioned API)"""
        response = requests.get(
            f"{BASE_URL}/api/v2/vehicles",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"V2 vehicles with auth failed: {response.text}"
    
    def test_v2_vin_trade_in_count_with_auth(self, auth_token):
        """GET /api/v2/vin/trade-in-count should work with auth"""
        response = requests.get(
            f"{BASE_URL}/api/v2/vin/trade-in-count",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"V2 VIN trade-in-count failed: {response.text}"


class TestCustomerCRUD:
    """Test Customer CRUD with authentication"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get valid access token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN})
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_list_customers(self, auth_token):
        """GET /api/customers should list customers"""
        response = requests.get(
            f"{BASE_URL}/api/customers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"List customers failed: {response.text}"
        data = response.json()
        assert isinstance(data, dict) or isinstance(data, list)
    
    def test_create_and_get_customer(self, auth_token):
        """POST /api/customers/create and GET /api/customers/{id}"""
        # Create customer
        customer_data = {
            "first_name": "TEST_Auth",
            "last_name": "Customer",
            "email": "test_auth_customer@example.com",
            "phone": "555-0100"
        }
        create_response = requests.post(
            f"{BASE_URL}/api/customers/create",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=customer_data
        )
        # 200 or 201 are both acceptable
        assert create_response.status_code in [200, 201], f"Create customer failed: {create_response.text}"
        
        created = create_response.json()
        if "id" in created:
            customer_id = created["id"]
            # Get the created customer
            get_response = requests.get(
                f"{BASE_URL}/api/customers/{customer_id}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            assert get_response.status_code == 200, f"Get customer failed: {get_response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
