"""
Test Iteration 10 Features:
- A/B Testing Framework APIs
- Device Registration for Push Notifications
- Check Engine Panel with 5 tabs
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cardealer-tool.preview.emergentagent.com').rstrip('/')


class TestABTestingFramework:
    """A/B Testing Framework API Tests"""
    
    def test_get_experiments_returns_4_experiments(self):
        """GET /api/ab/experiments should return 4 experiments"""
        response = requests.get(f"{BASE_URL}/api/ab/experiments")
        assert response.status_code == 200
        
        data = response.json()
        assert "experiments" in data
        experiments = data["experiments"]
        assert len(experiments) == 4, f"Expected 4 experiments, got {len(experiments)}"
        
        # Verify experiment IDs
        experiment_ids = [exp["experiment_id"] for exp in experiments]
        expected_ids = ["tone_effectiveness", "shortcut_vs_tower", "response_length", "vs_card_layout"]
        for exp_id in expected_ids:
            assert exp_id in experiment_ids, f"Missing experiment: {exp_id}"
    
    def test_get_experiments_structure(self):
        """Verify experiment structure has required fields"""
        response = requests.get(f"{BASE_URL}/api/ab/experiments")
        assert response.status_code == 200
        
        data = response.json()
        for exp in data["experiments"]:
            assert "experiment_id" in exp
            assert "name" in exp
            assert "description" in exp
            assert "is_active" in exp
            assert "variants" in exp
            assert len(exp["variants"]) >= 2, "Each experiment should have at least 2 variants"
    
    def test_get_variant_assignment(self):
        """GET /api/ab/variant/{experiment_id} should return variant assignment"""
        response = requests.get(f"{BASE_URL}/api/ab/variant/tone_effectiveness?user_id=test123")
        assert response.status_code == 200
        
        data = response.json()
        assert "variant_id" in data
        assert "variant_name" in data
        assert data["variant_id"] in ["A", "B", "C"]
    
    def test_get_variant_consistent_for_same_user(self):
        """Same user should get same variant (deterministic assignment)"""
        response1 = requests.get(f"{BASE_URL}/api/ab/variant/tone_effectiveness?user_id=consistent_user_123")
        response2 = requests.get(f"{BASE_URL}/api/ab/variant/tone_effectiveness?user_id=consistent_user_123")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        data1 = response1.json()
        data2 = response2.json()
        assert data1["variant_id"] == data2["variant_id"], "Same user should get same variant"
    
    def test_get_variant_invalid_experiment(self):
        """Invalid experiment ID should return 404"""
        response = requests.get(f"{BASE_URL}/api/ab/variant/nonexistent_experiment?user_id=test123")
        assert response.status_code == 404
    
    def test_track_event_success(self):
        """POST /api/ab/track should accept event tracking"""
        payload = {
            "experiment_id": "tone_effectiveness",
            "user_id": "test_user_track_123",
            "variant": "A",
            "event_type": "conversion",
            "metadata": {"test": True, "source": "pytest"}
        }
        response = requests.post(f"{BASE_URL}/api/ab/track", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
    
    def test_track_event_impression(self):
        """Track impression event"""
        payload = {
            "experiment_id": "shortcut_vs_tower",
            "user_id": "test_user_impression_123",
            "variant": "control",
            "event_type": "impression",
            "metadata": {}
        }
        response = requests.post(f"{BASE_URL}/api/ab/track", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
    
    def test_track_event_click(self):
        """Track click event"""
        payload = {
            "experiment_id": "response_length",
            "user_id": "test_user_click_123",
            "variant": "short",
            "event_type": "click",
            "metadata": {"element": "response_button"}
        }
        response = requests.post(f"{BASE_URL}/api/ab/track", json=payload)
        assert response.status_code == 200


class TestDeviceRegistration:
    """Device Registration for Push Notifications Tests"""
    
    def test_register_device_ios(self):
        """POST /api/notifications/register-device should accept iOS device"""
        payload = {
            "token": "ios_test_token_abc123",
            "platform": "ios",
            "user_id": "test_user_ios_123"
        }
        response = requests.post(f"{BASE_URL}/api/notifications/register-device", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "message" in data
    
    def test_register_device_android(self):
        """POST /api/notifications/register-device should accept Android device"""
        payload = {
            "token": "android_test_token_xyz789",
            "platform": "android",
            "user_id": "test_user_android_123"
        }
        response = requests.post(f"{BASE_URL}/api/notifications/register-device", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
    
    def test_register_device_web(self):
        """POST /api/notifications/register-device should accept web device"""
        payload = {
            "token": "web_push_subscription_token",
            "platform": "web",
            "user_id": "test_user_web_123"
        }
        response = requests.post(f"{BASE_URL}/api/notifications/register-device", json=payload)
        assert response.status_code == 200
    
    def test_register_device_missing_token(self):
        """Missing token should return validation error"""
        payload = {
            "platform": "ios",
            "user_id": "test_user_123"
        }
        response = requests.post(f"{BASE_URL}/api/notifications/register-device", json=payload)
        assert response.status_code == 422  # Validation error


class TestNotificationHistory:
    """Notification History API Tests"""
    
    def test_get_notifications(self):
        """GET /api/notifications should return notification list"""
        response = requests.get(f"{BASE_URL}/api/notifications?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data
        assert isinstance(data["notifications"], list)
    
    def test_get_notification_stats(self):
        """GET /api/notifications/stats should return statistics"""
        response = requests.get(f"{BASE_URL}/api/notifications/stats")
        assert response.status_code == 200
        
        data = response.json()
        # Should have stats structure
        assert isinstance(data, dict)


class TestIntegrationsHealth:
    """Integration Health API Tests"""
    
    def test_get_integrations_health(self):
        """GET /api/integrations/health should return health summary"""
        response = requests.get(f"{BASE_URL}/api/integrations/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "healthy" in data or "total" in data
    
    def test_get_integrations_list(self):
        """GET /api/integrations should return integrations list"""
        response = requests.get(f"{BASE_URL}/api/integrations")
        assert response.status_code == 200
        
        data = response.json()
        assert "integrations" in data


class TestNotificationConfig:
    """Notification Configuration API Tests"""
    
    def test_get_notification_config(self):
        """GET /api/notifications/config should return config status"""
        response = requests.get(f"{BASE_URL}/api/notifications/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "sms_configured" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
