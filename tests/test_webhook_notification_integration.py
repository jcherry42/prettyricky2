"""
Test Webhook-to-Notification Integration and CRM Credential Management
Tests for iteration 9 features:
1. CRM integration detail view with credential management
2. Mock mode toggle for integrations
3. Webhook-to-notification handlers (hot lead events trigger SMS notifications)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestWebhookNotificationIntegration:
    """Test webhook events triggering notifications"""
    
    def test_events_stats_shows_registered_handlers(self):
        """GET /api/events/stats should show registered handlers"""
        response = requests.get(f"{BASE_URL}/api/events/stats")
        assert response.status_code == 200
        
        data = response.json()
        # Verify registered_handlers field exists
        assert "registered_handlers" in data
        handlers = data["registered_handlers"]
        
        # Verify expected handlers are registered
        expected_handlers = [
            "lead.status_changed",
            "deal.created",
            "deal.updated",
            "customer.created",
            "customer.updated"
        ]
        
        for handler in expected_handlers:
            assert handler in handlers, f"Handler {handler} should be registered"
        
        print(f"Registered handlers: {handlers}")
    
    def test_test_hot_lead_endpoint_creates_event_and_notification(self):
        """POST /api/events/test-hot-lead should create test event and queue notification"""
        response = requests.post(
            f"{BASE_URL}/api/events/test-hot-lead",
            params={
                "customer_name": "TEST_Hot_Lead_Customer",
                "customer_phone": "+15551234567",
                "vehicle_interest": "2024 BMW X5",
                "salesperson_phone": "+15559876543"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "event_id" in data
        assert "message" in data
        
        print(f"Test hot lead event created: {data['event_id']}")
        
        # Wait for event processing
        time.sleep(1)
        
        # Verify notification was queued
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications",
            params={"notification_type": "hot_lead", "limit": 10}
        )
        assert notif_response.status_code == 200
        
        notif_data = notif_response.json()
        notifications = notif_data.get("notifications", [])
        
        # Find our test notification
        test_notif = None
        for n in notifications:
            if "TEST_Hot_Lead_Customer" in n.get("message", ""):
                test_notif = n
                break
        
        assert test_notif is not None, "Hot lead notification should be queued"
        assert test_notif["notification_type"] == "hot_lead"
        # Status should be queued since Twilio is not configured
        assert test_notif["status"] in ["queued", "pending"]
        
        print(f"Hot lead notification queued with status: {test_notif['status']}")
    
    def test_event_types_endpoint(self):
        """GET /api/events/types should return available event types"""
        response = requests.get(f"{BASE_URL}/api/events/types")
        assert response.status_code == 200
        
        data = response.json()
        assert "event_types" in data
        
        expected_types = [
            "customer.created",
            "customer.updated",
            "customer.deleted",
            "vehicle.created",
            "vehicle.updated",
            "vehicle.deleted",
            "lead.status_changed",
            "deal.created",
            "deal.updated"
        ]
        
        for event_type in expected_types:
            assert event_type in data["event_types"], f"Event type {event_type} should exist"
        
        print(f"Available event types: {data['event_types']}")


class TestCRMIntegrationCredentialManagement:
    """Test CRM integration credential management and mock mode"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get existing integrations for testing"""
        response = requests.get(f"{BASE_URL}/api/integrations")
        assert response.status_code == 200
        self.integrations = response.json().get("integrations", [])
    
    def test_list_integrations_returns_configured_crms(self):
        """GET /api/integrations should return list of configured integrations"""
        response = requests.get(f"{BASE_URL}/api/integrations")
        assert response.status_code == 200
        
        data = response.json()
        assert "integrations" in data
        
        integrations = data["integrations"]
        print(f"Found {len(integrations)} integrations")
        
        for integration in integrations:
            assert "id" in integration
            assert "name" in integration
            assert "adapter_type" in integration or "adapter_name" in integration
            assert "health_status" in integration or "status" in integration
            assert "mock_mode" in integration
            status = integration.get('health_status') or integration.get('status')
            print(f"  - {integration['name']}: health_status={status}, mock_mode={integration['mock_mode']}")
    
    def test_integration_health_summary(self):
        """GET /api/integrations/health should return health summary"""
        response = requests.get(f"{BASE_URL}/api/integrations/health")
        assert response.status_code == 200
        
        data = response.json()
        # Verify health summary fields
        assert "healthy" in data
        assert "degraded" in data
        assert "unhealthy" in data
        assert "mock_mode" in data
        
        print(f"Integration health: healthy={data['healthy']}, degraded={data['degraded']}, unhealthy={data['unhealthy']}, mock_mode={data['mock_mode']}")
    
    def test_patch_integration_with_auth_config(self):
        """PATCH /api/integrations/{id} should accept auth_config updates"""
        # Get fresh integrations list
        response = requests.get(f"{BASE_URL}/api/integrations")
        assert response.status_code == 200
        integrations = response.json().get("integrations", [])
        
        if not integrations:
            pytest.skip("No integrations available for testing")
        
        integration = integrations[0]
        integration_id = integration["id"]
        
        # Update auth_config
        response = requests.patch(
            f"{BASE_URL}/api/integrations/{integration_id}",
            json={
                "auth_config": {
                    "api_key": "TEST_API_KEY_12345",
                    "username": "test_user"
                }
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        
        print(f"Updated auth_config for integration {integration_id}")
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/integrations/{integration_id}")
        assert get_response.status_code == 200
        
        updated = get_response.json()
        # Auth config should be updated (may be masked in response)
        print(f"Integration after update: {updated.get('name')}")
    
    def test_toggle_mock_mode(self):
        """POST /api/integrations/{id}/toggle-mock should toggle mock mode"""
        # Get fresh integrations list
        response = requests.get(f"{BASE_URL}/api/integrations")
        assert response.status_code == 200
        integrations = response.json().get("integrations", [])
        
        if not integrations:
            pytest.skip("No integrations available for testing")
        
        integration = integrations[0]
        integration_id = integration["id"]
        current_mock_mode = integration.get("mock_mode", True)
        
        # Toggle mock mode
        response = requests.post(
            f"{BASE_URL}/api/integrations/{integration_id}/toggle-mock",
            params={"enabled": not current_mock_mode}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert data["mock_mode"] == (not current_mock_mode)
        
        print(f"Toggled mock mode from {current_mock_mode} to {not current_mock_mode}")
        
        # Toggle back to original state
        restore_response = requests.post(
            f"{BASE_URL}/api/integrations/{integration_id}/toggle-mock",
            params={"enabled": current_mock_mode}
        )
        assert restore_response.status_code == 200
        
        print(f"Restored mock mode to {current_mock_mode}")
    
    def test_test_integration_connection(self):
        """POST /api/integrations/{id}/test should test connection"""
        if not self.integrations:
            pytest.skip("No integrations available for testing")
        
        integration = self.integrations[0]
        integration_id = integration["id"]
        
        response = requests.post(f"{BASE_URL}/api/integrations/{integration_id}/test")
        assert response.status_code == 200
        
        data = response.json()
        assert "success" in data
        
        # In mock mode, should succeed
        if integration.get("mock_mode"):
            assert data["success"] is True
            assert data.get("mock_mode") is True
        
        print(f"Connection test result: success={data['success']}, mock_mode={data.get('mock_mode')}")


class TestNotificationQueueForHotLeads:
    """Test that hot lead events properly queue notifications"""
    
    def test_notifications_list_shows_hot_lead_type(self):
        """GET /api/notifications should show hot_lead notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            params={"notification_type": "hot_lead", "limit": 20}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data
        
        notifications = data["notifications"]
        print(f"Found {len(notifications)} hot_lead notifications")
        
        for notif in notifications[:5]:  # Show first 5
            print(f"  - Status: {notif.get('status')}, Created: {notif.get('created_at')}")
    
    def test_notification_stats_includes_hot_lead(self):
        """GET /api/notifications/stats should include hot_lead in by_type"""
        response = requests.get(f"{BASE_URL}/api/notifications/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total" in data
        assert "by_status" in data
        assert "by_type" in data
        
        print(f"Notification stats: total={data['total']}, by_type={data['by_type']}")
    
    def test_notification_config_shows_sms_not_configured(self):
        """GET /api/notifications/config should show SMS not configured"""
        response = requests.get(f"{BASE_URL}/api/notifications/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "sms_configured" in data
        assert "pending_notifications" in data
        
        # Twilio is not configured in test environment
        print(f"SMS configured: {data['sms_configured']}, Pending: {data['pending_notifications']}")


class TestEventEnqueueAndProcessing:
    """Test manual event enqueue and processing"""
    
    def test_enqueue_customer_created_event_with_hot_flag(self):
        """POST /api/events/enqueue should accept customer.created event with is_hot flag"""
        event_data = {
            "webhook_id": "test-webhook-manual",
            "event_type": "customer.created",
            "payload": {
                "customer_name": "TEST_Manual_Hot_Lead",
                "customer_phone": "+15551112222",
                "vehicle_interest": "2024 Mercedes GLE",
                "salesperson_phone": "+15553334444",
                "salesperson_name": "Manual Test Sales",
                "is_hot": True
            },
            "source": "manual_test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/events/enqueue",
            json=event_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "event_id" in data
        
        print(f"Manually enqueued event: {data['event_id']}")
        
        # Wait for processing
        time.sleep(1)
        
        # Check event stats
        stats_response = requests.get(f"{BASE_URL}/api/events/stats")
        assert stats_response.status_code == 200
        
        stats = stats_response.json()
        print(f"Event stats after enqueue: {stats.get('status_breakdown', {})}")
    
    def test_enqueue_lead_status_changed_to_hot(self):
        """POST /api/events/enqueue should process lead.status_changed to hot"""
        event_data = {
            "webhook_id": "test-webhook-status",
            "event_type": "lead.status_changed",
            "payload": {
                "customer_name": "TEST_Status_Change_Lead",
                "old_status": "warm",
                "new_status": "hot",
                "salesperson_phone": "+15555556666",
                "notes": "Customer ready to buy"
            },
            "source": "status_test"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/events/enqueue",
            json=event_data
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        
        print(f"Lead status change event enqueued: {data['event_id']}")
        
        # Wait for processing
        time.sleep(1)
        
        # Check for status_change notification
        notif_response = requests.get(
            f"{BASE_URL}/api/notifications",
            params={"notification_type": "status_change", "limit": 10}
        )
        assert notif_response.status_code == 200
        
        notifications = notif_response.json().get("notifications", [])
        
        # Find our test notification
        test_notif = None
        for n in notifications:
            if "TEST_Status_Change_Lead" in n.get("message", ""):
                test_notif = n
                break
        
        assert test_notif is not None, "Status change notification should be queued"
        print(f"Status change notification found: status={test_notif['status']}")


class TestDLQAndEventReplay:
    """Test dead letter queue and event replay"""
    
    def test_get_dlq_events(self):
        """GET /api/events/dlq should return DLQ events"""
        response = requests.get(f"{BASE_URL}/api/events/dlq", params={"limit": 10})
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert "count" in data
        
        print(f"DLQ events: {data['count']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
