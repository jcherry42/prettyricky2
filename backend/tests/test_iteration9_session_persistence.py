"""
Iteration 9 Session Persistence Tests
======================================
Testing the new session persistence feature:
- POST /api/sessions/save - Full session snapshot
- GET /api/sessions/restore - Restore saved session
- POST /api/sessions/auto-save - Delta/incremental save
- DELETE /api/sessions - Clear session

Plus regression tests for existing functionality:
- Customer CRUD with auth
- VIN decode
- Anomaly detection scan
- AI model routing (gpt-4o-mini for license_ocr)
- Health endpoint (public)

Auth flow uses factory-reset + setup-pin + login with PIN 11111.
Sessions require valid JWT Bearer token (protected endpoints).
"""

import pytest
import requests
import time
import os

# Base URL from environment or default
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://apex-service-advisor.preview.emergentagent.com').rstrip('/')

# Test PIN
TEST_PIN = "11111"


@pytest.fixture(scope="module")
def auth_token():
    """Setup auth: factory-reset + setup-pin + login, return access_token"""
    # Factory reset to clear any existing PIN state
    reset_response = requests.post(f"{BASE_URL}/api/auth/factory-reset")
    if reset_response.status_code == 200:
        print("Factory reset successful")

    # Setup PIN
    setup_response = requests.post(f"{BASE_URL}/api/auth/setup-pin", json={"pin": TEST_PIN})
    if setup_response.status_code in [200, 201]:
        print("PIN setup successful")
    elif setup_response.status_code == 409:
        print("PIN already set, continuing with existing PIN")

    # Login to get token
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN})
    if login_response.status_code != 200:
        pytest.skip(f"Could not login: {login_response.status_code} - {login_response.text}")

    data = login_response.json()
    token = data.get("access_token")
    assert token, "No access_token in login response"
    print("Login successful, got access_token")
    return token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for protected endpoints"""
    return {"Authorization": f"Bearer {auth_token}"}


# ============== SESSION PERSISTENCE TESTS ==============

class TestSessionSave:
    """Test POST /api/sessions/save - Full session snapshot"""

    def test_session_save_returns_success(self, auth_headers):
        """POST /api/sessions/save - should return success:true"""
        session_payload = {
            "navigation_state": {"currentRoute": "HomeScreen", "index": 0},
            "active_customer_id": "cust_test_123",
            "active_customer": {"id": "cust_test_123", "name": "Test Customer"},
            "form_drafts": {"intake_form": {"vin": "1HGCM82633A004352"}},
            "tower_talk_history": [{"role": "user", "content": "Hello"}],
            "ptt_last_result": {"text": "Test transcription"},
            "modal_states": {"customerDetail": False, "vinScanner": True},
            "search_query": "test search",
            "scroll_positions": {"customerList": 150.5},
            "intake_state": {"step": 2, "completed": False},
            "version": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/save",
            json=session_payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True, f"Expected success:true, got {data}"
        print("PASS: POST /api/sessions/save returns success:true")

    def test_session_save_minimal_payload(self, auth_headers):
        """POST /api/sessions/save with minimal payload - should work"""
        session_payload = {
            "search_query": "minimal test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/save",
            json=session_payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True
        print("PASS: POST /api/sessions/save with minimal payload works")


class TestSessionRestore:
    """Test GET /api/sessions/restore - Restore saved session"""

    def test_session_restore_returns_saved_data(self, auth_headers):
        """GET /api/sessions/restore - should return saved session data"""
        # First save a session
        test_search = f"restore_test_{int(time.time())}"
        session_payload = {
            "search_query": test_search,
            "active_customer_id": "cust_restore_test",
            "navigation_state": {"currentRoute": "CustomerDetail"}
        }
        
        save_response = requests.post(
            f"{BASE_URL}/api/sessions/save",
            json=session_payload,
            headers=auth_headers
        )
        assert save_response.status_code == 200, f"Failed to save session: {save_response.text}"
        
        # Now restore
        restore_response = requests.get(
            f"{BASE_URL}/api/sessions/restore",
            headers=auth_headers
        )
        
        assert restore_response.status_code == 200, f"Expected 200, got {restore_response.status_code}: {restore_response.text}"
        data = restore_response.json()
        assert data.get("success") is True, f"Expected success:true, got {data}"
        
        session = data.get("session")
        assert session is not None, "Expected session data in response"
        assert session.get("search_query") == test_search, f"Expected search_query={test_search}, got {session.get('search_query')}"
        print("PASS: GET /api/sessions/restore returns saved session data")

    def test_session_restore_includes_age_seconds(self, auth_headers):
        """GET /api/sessions/restore - should include age_seconds field"""
        # Save a session first
        save_response = requests.post(
            f"{BASE_URL}/api/sessions/save",
            json={"search_query": "age_test"},
            headers=auth_headers
        )
        assert save_response.status_code == 200
        
        # Wait a bit to get measurable age
        time.sleep(1)
        
        # Restore
        restore_response = requests.get(
            f"{BASE_URL}/api/sessions/restore",
            headers=auth_headers
        )
        
        assert restore_response.status_code == 200
        data = restore_response.json()
        
        age_seconds = data.get("age_seconds")
        assert age_seconds is not None, "Expected age_seconds in response"
        assert age_seconds >= 1, f"Expected age_seconds >= 1, got {age_seconds}"
        print(f"PASS: GET /api/sessions/restore includes age_seconds={age_seconds}")


class TestSessionAutoSave:
    """Test POST /api/sessions/auto-save - Delta/incremental save"""

    def test_auto_save_returns_success(self, auth_headers):
        """POST /api/sessions/auto-save - should return success:true"""
        delta_payload = {
            "delta": {
                "scroll_positions": {"customerList": 300.0},
                "search_query": "auto_saved_search"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sessions/auto-save",
            json=delta_payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") is True, f"Expected success:true, got {data}"
        print("PASS: POST /api/sessions/auto-save returns success:true")

    def test_auto_save_merges_delta_into_existing_session(self, auth_headers):
        """POST /api/sessions/auto-save - delta merges into existing session"""
        # First save a full session
        initial_session = {
            "search_query": "initial_search",
            "active_customer_id": "cust_autosave_test",
            "navigation_state": {"currentRoute": "HomeScreen"}
        }
        save_response = requests.post(
            f"{BASE_URL}/api/sessions/save",
            json=initial_session,
            headers=auth_headers
        )
        assert save_response.status_code == 200
        
        # Now auto-save a delta (only update search_query)
        delta_payload = {
            "delta": {
                "search_query": "updated_by_autosave"
            }
        }
        autosave_response = requests.post(
            f"{BASE_URL}/api/sessions/auto-save",
            json=delta_payload,
            headers=auth_headers
        )
        assert autosave_response.status_code == 200
        
        # Restore and verify both old fields and new delta are present
        restore_response = requests.get(
            f"{BASE_URL}/api/sessions/restore",
            headers=auth_headers
        )
        assert restore_response.status_code == 200
        
        data = restore_response.json()
        session = data.get("session")
        assert session is not None
        
        # Check that auto-save updated search_query
        assert session.get("search_query") == "updated_by_autosave", \
            f"Expected search_query='updated_by_autosave', got {session.get('search_query')}"
        
        # Check that existing field (active_customer_id) was preserved
        assert session.get("active_customer_id") == "cust_autosave_test", \
            f"Expected active_customer_id='cust_autosave_test', got {session.get('active_customer_id')}"
        
        print("PASS: auto-save delta merges into existing session, preserving other fields")


class TestSessionDelete:
    """Test DELETE /api/sessions - Clear session"""

    def test_session_delete_returns_success(self, auth_headers):
        """DELETE /api/sessions - should return success:true"""
        # First save a session
        save_response = requests.post(
            f"{BASE_URL}/api/sessions/save",
            json={"search_query": "delete_test"},
            headers=auth_headers
        )
        assert save_response.status_code == 200
        
        # Delete the session
        delete_response = requests.delete(
            f"{BASE_URL}/api/sessions",
            headers=auth_headers
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        data = delete_response.json()
        assert data.get("success") is True, f"Expected success:true, got {data}"
        print("PASS: DELETE /api/sessions returns success:true")

    def test_session_restore_after_delete_returns_null(self, auth_headers):
        """GET /api/sessions/restore after DELETE - returns session:null"""
        # Save a session
        save_response = requests.post(
            f"{BASE_URL}/api/sessions/save",
            json={"search_query": "delete_restore_test"},
            headers=auth_headers
        )
        assert save_response.status_code == 200
        
        # Delete the session
        delete_response = requests.delete(
            f"{BASE_URL}/api/sessions",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        
        # Try to restore - should return session:null
        restore_response = requests.get(
            f"{BASE_URL}/api/sessions/restore",
            headers=auth_headers
        )
        
        assert restore_response.status_code == 200
        data = restore_response.json()
        assert data.get("success") is True
        assert data.get("session") is None, f"Expected session:null after delete, got {data.get('session')}"
        assert "No saved session" in data.get("message", ""), \
            f"Expected 'No saved session' message, got {data.get('message')}"
        print("PASS: GET /api/sessions/restore after DELETE returns session:null, message:'No saved session'")


class TestSessionAuthRequired:
    """Test that all session endpoints return 401 without Bearer token"""

    def test_session_save_requires_auth(self):
        """POST /api/sessions/save - returns 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/save",
            json={"search_query": "test"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: POST /api/sessions/save returns 401 without auth")

    def test_session_restore_requires_auth(self):
        """GET /api/sessions/restore - returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/sessions/restore")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: GET /api/sessions/restore returns 401 without auth")

    def test_session_auto_save_requires_auth(self):
        """POST /api/sessions/auto-save - returns 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/sessions/auto-save",
            json={"delta": {"search_query": "test"}}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: POST /api/sessions/auto-save returns 401 without auth")

    def test_session_delete_requires_auth(self):
        """DELETE /api/sessions - returns 401 without auth"""
        response = requests.delete(f"{BASE_URL}/api/sessions")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: DELETE /api/sessions returns 401 without auth")


# ============== REGRESSION TESTS ==============

class TestRegressionHealth:
    """Regression: Health endpoint should still be public"""

    def test_health_endpoint_public(self):
        """GET /api/health - public, should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("PASS: /api/health returns 200 (public)")


class TestRegressionCustomerCRUD:
    """Regression: Customer CRUD still works with auth"""

    def test_list_customers(self, auth_headers):
        """GET /api/customers - list customers with auth"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers)
        assert response.status_code == 200
        print("PASS: GET /api/customers returns 200")


class TestRegressionVINDecode:
    """Regression: VIN decode still works"""

    def test_vin_decode_honda(self, auth_headers):
        """GET /api/vin/decode/1HGCM82633A004352 - should return Honda"""
        vin = "1HGCM82633A004352"
        response = requests.get(f"{BASE_URL}/api/vin/decode/{vin}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("make", "").upper() == "HONDA"
        print("PASS: VIN decode returns Honda Accord")


class TestRegressionAnomalyDetection:
    """Regression: Anomaly detection still works"""

    def test_anomaly_scan(self, auth_headers):
        """POST /api/anomalies/scan - should work with auth"""
        response = requests.post(f"{BASE_URL}/api/anomalies/scan", headers=auth_headers)
        assert response.status_code == 200
        print("PASS: POST /api/anomalies/scan returns 200")


class TestRegressionAIModelRouting:
    """Regression: AI model routing (license_ocr=gpt-4o-mini)"""

    def test_ai_stats_license_ocr_model(self):
        """GET /api/ai/stats - license_ocr should use gpt-4o-mini"""
        response = requests.get(f"{BASE_URL}/api/ai/stats")
        assert response.status_code == 200
        data = response.json()
        model_routes = data.get("model_routes", {})
        license_ocr_route = model_routes.get("license_ocr", {})
        assert license_ocr_route.get("primary") == "gpt-4o-mini", \
            f"Expected license_ocr primary=gpt-4o-mini, got {license_ocr_route.get('primary')}"
        print("PASS: AI Gateway license_ocr uses gpt-4o-mini")


# ============== MAIN ==============

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
