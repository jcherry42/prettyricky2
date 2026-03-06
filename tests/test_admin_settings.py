"""
Test Admin Settings Panel Backend APIs
Tests for notification configuration and CRM integration health endpoints
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://deal-closer-ai-3.preview.emergentagent.com').rstrip('/')


class TestNotificationConfig:
    """Tests for notification configuration endpoints"""
    
    def test_get_notification_config(self):
        """Test GET /api/notifications/config returns configuration status"""
        response = requests.get(f"{BASE_URL}/api/notifications/config")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "sms_configured" in data
        assert "from_number" in data
        assert "pending_notifications" in data
        
        # Verify data types
        assert isinstance(data["sms_configured"], bool)
        assert isinstance(data["pending_notifications"], int)
        
        print(f"✓ Notification config: sms_configured={data['sms_configured']}, pending={data['pending_notifications']}")
    
    def test_twilio_config_validation_missing_fields(self):
        """Test POST /api/notifications/config/twilio validates required fields"""
        # Test with empty payload
        response = requests.post(
            f"{BASE_URL}/api/notifications/config/twilio",
            json={}
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422
        print("✓ Twilio config validation rejects empty payload")
    
    def test_twilio_config_validation_partial_fields(self):
        """Test POST /api/notifications/config/twilio validates all required fields"""
        # Test with partial payload
        response = requests.post(
            f"{BASE_URL}/api/notifications/config/twilio",
            json={
                "account_sid": "ACtest123"
            }
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422
        print("✓ Twilio config validation rejects partial payload")
    
    def test_twilio_config_invalid_credentials(self):
        """Test POST /api/notifications/config/twilio with invalid credentials"""
        # Test with invalid credentials (will fail Twilio validation)
        response = requests.post(
            f"{BASE_URL}/api/notifications/config/twilio",
            json={
                "account_sid": "ACinvalid123456789012345678901234",
                "auth_token": "invalid_token_12345678901234567",
                "from_number": "+15551234567"
            }
        )
        
        # Should return 400 for invalid credentials
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Twilio config rejects invalid credentials: {data['detail'][:50]}...")


class TestNotificationStats:
    """Tests for notification statistics endpoint"""
    
    def test_get_notification_stats(self):
        """Test GET /api/notifications/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/notifications/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total" in data
        assert "sent_today" in data
        assert "by_status" in data
        assert "by_type" in data
        assert "configured" in data
        
        # Verify data types
        assert isinstance(data["total"], int)
        assert isinstance(data["sent_today"], int)
        assert isinstance(data["by_status"], dict)
        assert isinstance(data["by_type"], dict)
        assert isinstance(data["configured"], bool)
        
        print(f"✓ Notification stats: total={data['total']}, sent_today={data['sent_today']}, configured={data['configured']}")


class TestNotificationList:
    """Tests for notification list endpoint"""
    
    def test_get_notifications_list(self):
        """Test GET /api/notifications returns list of notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "notifications" in data
        assert isinstance(data["notifications"], list)
        
        print(f"✓ Notifications list: {len(data['notifications'])} notifications")
    
    def test_get_notifications_with_filters(self):
        """Test GET /api/notifications with filters"""
        # Test with status filter
        response = requests.get(f"{BASE_URL}/api/notifications?status=pending")
        assert response.status_code == 200
        
        # Test with type filter
        response = requests.get(f"{BASE_URL}/api/notifications?notification_type=hot_lead")
        assert response.status_code == 200
        
        # Test with limit
        response = requests.get(f"{BASE_URL}/api/notifications?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["notifications"]) <= 10
        
        print("✓ Notifications list filters work correctly")


class TestHotLeadNotification:
    """Tests for hot lead notification endpoint"""
    
    def test_send_hot_lead_notification_queued(self):
        """Test POST /api/notifications/hot-lead queues notification when Twilio not configured"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/hot-lead",
            json={
                "salesperson_phone": "+15551234567",
                "salesperson_name": "Test Salesperson",
                "customer_name": "Test Customer",
                "customer_phone": "+15559876543",
                "vehicle_interest": "2024 Test Vehicle"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        assert "notification_id" in data
        assert "channel" in data
        
        # Should be queued since Twilio is not configured
        assert data["success"] == True
        assert data["channel"] == "sms"
        
        print(f"✓ Hot lead notification queued: id={data['notification_id']}")
    
    def test_send_hot_lead_notification_validation(self):
        """Test POST /api/notifications/hot-lead validates required fields"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/hot-lead",
            json={
                "salesperson_phone": "+15551234567"
                # Missing required fields
            }
        )
        
        assert response.status_code == 422
        print("✓ Hot lead notification validation works")


class TestStatusChangeNotification:
    """Tests for status change notification endpoint"""
    
    def test_send_status_change_notification(self):
        """Test POST /api/notifications/status-change queues notification"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/status-change",
            json={
                "salesperson_phone": "+15551234567",
                "customer_name": "Test Customer",
                "old_status": "warm",
                "new_status": "hot",
                "notes": "Customer ready to buy"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert "notification_id" in data
        assert data["success"] == True
        
        print(f"✓ Status change notification queued: id={data['notification_id']}")


class TestFollowUpReminder:
    """Tests for follow-up reminder notification endpoint"""
    
    def test_schedule_follow_up_reminder(self):
        """Test POST /api/notifications/follow-up-reminder schedules reminder"""
        remind_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/notifications/follow-up-reminder",
            json={
                "salesperson_phone": "+15551234567",
                "customer_name": "Test Customer",
                "vehicle_interest": "2024 Test Vehicle",
                "last_contact": "Yesterday",
                "remind_at": remind_at
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert "notification_id" in data
        assert data["success"] == True
        
        print(f"✓ Follow-up reminder scheduled: id={data['notification_id']}")


class TestProcessScheduledNotifications:
    """Tests for processing scheduled notifications"""
    
    def test_process_scheduled_notifications(self):
        """Test POST /api/notifications/process-scheduled processes queue"""
        response = requests.post(f"{BASE_URL}/api/notifications/process-scheduled")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        assert "sent" in data
        assert "failed" in data
        assert "skipped" in data
        
        # Verify data types
        assert isinstance(data["sent"], int)
        assert isinstance(data["failed"], int)
        assert isinstance(data["skipped"], int)
        
        print(f"✓ Process scheduled: sent={data['sent']}, failed={data['failed']}, skipped={data['skipped']}")


class TestIntegrationsHealth:
    """Tests for CRM integrations health endpoints"""
    
    def test_get_integrations_health(self):
        """Test GET /api/integrations/health returns health summary"""
        response = requests.get(f"{BASE_URL}/api/integrations/health")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "total" in data
        assert "healthy" in data
        assert "degraded" in data
        assert "unhealthy" in data
        assert "mock_mode" in data
        assert "integrations" in data
        assert "overall_status" in data
        
        # Verify data types
        assert isinstance(data["total"], int)
        assert isinstance(data["healthy"], int)
        assert isinstance(data["degraded"], int)
        assert isinstance(data["unhealthy"], int)
        assert isinstance(data["mock_mode"], int)
        assert isinstance(data["integrations"], list)
        
        print(f"✓ Integrations health: total={data['total']}, healthy={data['healthy']}, mock={data['mock_mode']}")
    
    def test_get_integrations_list(self):
        """Test GET /api/integrations returns list of integrations"""
        response = requests.get(f"{BASE_URL}/api/integrations")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "integrations" in data
        assert isinstance(data["integrations"], list)
        
        # Verify integration structure if any exist
        if len(data["integrations"]) > 0:
            integration = data["integrations"][0]
            assert "name" in integration
            assert "adapter_type" in integration
            assert "mock_mode" in integration
            assert "is_active" in integration
        
        print(f"✓ Integrations list: {len(data['integrations'])} integrations")


class TestFavoritesCategories:
    """Tests for favorites categories endpoint"""
    
    def test_get_favorites_categories(self):
        """Test GET /api/favorites/categories returns categories"""
        response = requests.get(f"{BASE_URL}/api/favorites/categories")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) > 0
        
        # Verify category structure
        category = data["categories"][0]
        assert "id" in category
        assert "label" in category
        assert "icon" in category
        
        print(f"✓ Favorites categories: {len(data['categories'])} categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
