"""
Test Suite for New Features:
- Conversation History with 30-day TTL
- Analytics Dashboard
- Webhook Event Processing
- Favorites Categories
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestConversationHistory:
    """Tests for Conversation History API endpoints"""
    
    def test_get_conversation_categories(self):
        """Test GET /api/conversations/categories - List available categories"""
        response = requests.get(f"{BASE_URL}/api/conversations/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        assert len(categories) >= 8  # At least 8 categories defined
        
        # Verify category structure
        for cat in categories:
            assert "id" in cat
            assert "label" in cat
            assert "icon" in cat
        
        # Verify expected categories exist
        category_ids = [c["id"] for c in categories]
        expected_categories = ["price_negotiation", "trade_in", "objection_handling", 
                              "follow_up", "competitor", "financing", "features", "general"]
        for expected in expected_categories:
            assert expected in category_ids, f"Missing category: {expected}"
    
    def test_create_conversation(self):
        """Test POST /api/conversations - Create conversation with auto-detect category"""
        session_id = f"test-session-{uuid.uuid4()}"
        
        payload = {
            "session_id": session_id,
            "situation": "Customer says the price is too high and wants a discount",
            "response": "I understand your concern about the price. Let me see what we can do...",
            "language": "en"
        }
        
        response = requests.post(f"{BASE_URL}/api/conversations", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "conversation" in data
        
        conv = data["conversation"]
        assert conv["session_id"] == session_id
        assert conv["situation"] == payload["situation"]
        assert conv["response"] == payload["response"]
        assert "id" in conv
        assert "created_at" in conv
        assert "expires_at" in conv
        
        # Auto-detect should categorize as price_negotiation
        assert conv["category"] == "price_negotiation"
    
    def test_create_conversation_with_explicit_category(self):
        """Test creating conversation with explicit category"""
        session_id = f"test-session-{uuid.uuid4()}"
        
        payload = {
            "session_id": session_id,
            "situation": "General inquiry about the dealership",
            "response": "Welcome to our dealership!",
            "category": "follow_up",
            "language": "en"
        }
        
        response = requests.post(f"{BASE_URL}/api/conversations", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        conv = data["conversation"]
        assert conv["category"] == "follow_up"
    
    def test_create_conversation_with_shortcut(self):
        """Test creating conversation with shortcut_used field"""
        session_id = f"test-session-{uuid.uuid4()}"
        
        payload = {
            "session_id": session_id,
            "situation": "Customer needs to think about it",
            "response": "I completely understand...",
            "shortcut_used": "need_think",
            "language": "en"
        }
        
        response = requests.post(f"{BASE_URL}/api/conversations", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        conv = data["conversation"]
        # Shortcut should map to objection_handling
        assert conv["category"] == "objection_handling"
        assert conv["shortcut_used"] == "need_think"
    
    def test_get_conversations(self):
        """Test GET /api/conversations - List conversations"""
        response = requests.get(f"{BASE_URL}/api/conversations")
        assert response.status_code == 200
        
        data = response.json()
        assert "conversations" in data
        assert "count" in data
        assert isinstance(data["conversations"], list)
    
    def test_get_conversations_with_category_filter(self):
        """Test GET /api/conversations with category filter"""
        response = requests.get(f"{BASE_URL}/api/conversations?category=price_negotiation")
        assert response.status_code == 200
        
        data = response.json()
        assert "conversations" in data
        # All returned conversations should have the filtered category
        for conv in data["conversations"]:
            assert conv.get("category") == "price_negotiation"
    
    def test_get_conversation_stats(self):
        """Test GET /api/conversations/stats - Get statistics"""
        response = requests.get(f"{BASE_URL}/api/conversations/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_conversations" in data
        assert "conversations_24h" in data
        assert "by_category" in data
        assert "by_language" in data
        assert "top_shortcuts" in data
        
        assert isinstance(data["total_conversations"], int)
        assert isinstance(data["by_category"], dict)


class TestAnalyticsDashboard:
    """Tests for Analytics Dashboard API endpoints"""
    
    def test_get_dashboard_summary(self):
        """Test GET /api/analytics/dashboard - Full dashboard summary"""
        response = requests.get(f"{BASE_URL}/api/analytics/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify all sections are present
        assert "sales_performance" in data
        assert "customer_engagement" in data
        assert "inventory_metrics" in data
        assert "conversation_insights" in data
        assert "integration_health" in data
        assert "generated_at" in data
    
    def test_get_sales_analytics(self):
        """Test GET /api/analytics/sales - Sales performance metrics"""
        response = requests.get(f"{BASE_URL}/api/analytics/sales")
        assert response.status_code == 200
        
        data = response.json()
        assert "period_days" in data
        assert "total_responses_generated" in data
        assert "responses_per_day" in data
        assert "shortcut_usage_rate" in data
        assert "daily_breakdown" in data
        assert "top_categories" in data
        assert "efficiency_score" in data
        
        assert isinstance(data["total_responses_generated"], int)
        assert isinstance(data["efficiency_score"], (int, float))
    
    def test_get_sales_analytics_with_days_param(self):
        """Test GET /api/analytics/sales with custom days parameter"""
        response = requests.get(f"{BASE_URL}/api/analytics/sales?days=7")
        assert response.status_code == 200
        
        data = response.json()
        assert data["period_days"] == 7
    
    def test_get_customer_analytics(self):
        """Test GET /api/analytics/customers - Customer engagement metrics"""
        response = requests.get(f"{BASE_URL}/api/analytics/customers")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_customers" in data
        assert "new_leads_7d" in data
        assert "lead_status_breakdown" in data
        assert "hot_leads" in data
        assert "warm_leads" in data
        assert "cold_leads" in data
        assert "sold" in data
        assert "conversion_rate" in data
        assert "contact_completeness" in data
        assert "follow_up_priority" in data
        
        # Verify contact_completeness structure
        cc = data["contact_completeness"]
        assert "with_email" in cc
        assert "with_phone" in cc
        assert "with_vehicle_interest" in cc
        
        # Verify follow_up_priority structure
        fp = data["follow_up_priority"]
        assert "immediate" in fp
        assert "this_week" in fp
        assert "nurture" in fp
    
    def test_get_inventory_analytics(self):
        """Test GET /api/analytics/inventory - Inventory metrics"""
        response = requests.get(f"{BASE_URL}/api/analytics/inventory")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_vehicles" in data
        assert "available" in data
        assert "sold" in data
        assert "pending" in data
        assert "availability_rate" in data
        assert "turnover_rate" in data
        assert "price_metrics" in data
        assert "top_makes" in data
        assert "by_model_year" in data
        assert "new_vs_used" in data
        
        # Verify price_metrics structure
        pm = data["price_metrics"]
        assert "average_price" in pm
        assert "min_price" in pm
        assert "max_price" in pm
        assert "total_inventory_value" in pm
    
    def test_get_conversation_insights(self):
        """Test GET /api/analytics/conversations - Conversation insights"""
        response = requests.get(f"{BASE_URL}/api/analytics/conversations")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_conversations" in data
        assert "bilingual_usage_rate" in data
        assert "avg_response_length" in data
        assert "peak_usage_hour" in data
        assert "hourly_distribution" in data
        assert "top_quick_shortcuts" in data
        assert "ai_efficiency_score" in data
    
    def test_get_integration_analytics(self):
        """Test GET /api/analytics/integrations - Integration health"""
        response = requests.get(f"{BASE_URL}/api/analytics/integrations")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_integrations" in data
        assert "healthy" in data
        assert "degraded" in data
        assert "unhealthy" in data
        assert "mock_mode_count" in data
        assert "health_score" in data
        assert "total_records_synced" in data
        assert "real_connections" in data
    
    def test_get_metric_trends(self):
        """Test GET /api/analytics/trends/{metric} - Trend data"""
        response = requests.get(f"{BASE_URL}/api/analytics/trends/conversations?days=7")
        assert response.status_code == 200
        
        data = response.json()
        assert data["metric"] == "conversations"
        assert data["period_days"] == 7
        assert "data_points" in data
        assert "total" in data


class TestWebhookEventProcessing:
    """Tests for Webhook Event Processing API endpoints"""
    
    def test_get_event_stats(self):
        """Test GET /api/events/stats - Event processing statistics"""
        response = requests.get(f"{BASE_URL}/api/events/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "status_breakdown" in data
        assert "top_event_types" in data
        assert "events_24h" in data
        assert "avg_processing_ms" in data
        assert "dlq_count" in data
        assert "registered_handlers" in data
        
        assert isinstance(data["status_breakdown"], dict)
        assert isinstance(data["top_event_types"], list)
    
    def test_get_event_types(self):
        """Test GET /api/events/types - Available event types"""
        response = requests.get(f"{BASE_URL}/api/events/types")
        assert response.status_code == 200
        
        data = response.json()
        assert "event_types" in data
        
        event_types = data["event_types"]
        assert len(event_types) >= 10  # At least 10 event types defined
        
        # Verify expected event types
        expected_types = [
            "customer.created", "customer.updated", "customer.deleted",
            "vehicle.created", "vehicle.updated", "vehicle.deleted",
            "lead.status_changed", "deal.created", "deal.updated",
            "sync.completed", "integration.health"
        ]
        for expected in expected_types:
            assert expected in event_types, f"Missing event type: {expected}"
    
    def test_enqueue_event(self):
        """Test POST /api/events/enqueue - Manually enqueue event"""
        payload = {
            "webhook_id": f"test-webhook-{uuid.uuid4()}",
            "event_type": "customer.created",
            "payload": {
                "customer_id": "test-123",
                "name": "Test Customer",
                "email": "test@example.com"
            },
            "source": "test"
        }
        
        response = requests.post(f"{BASE_URL}/api/events/enqueue", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "event_id" in data
    
    def test_get_dlq_events(self):
        """Test GET /api/events/dlq - Dead letter queue events"""
        response = requests.get(f"{BASE_URL}/api/events/dlq")
        assert response.status_code == 200
        
        data = response.json()
        assert "events" in data
        assert "count" in data
        assert isinstance(data["events"], list)


class TestFavoritesCategories:
    """Tests for Favorites Categories API endpoint"""
    
    def test_get_favorite_categories(self):
        """Test GET /api/favorites/categories - List favorite categories"""
        response = requests.get(f"{BASE_URL}/api/favorites/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        assert len(categories) >= 9  # At least 9 categories defined
        
        # Verify category structure
        for cat in categories:
            assert "id" in cat
            assert "label" in cat
            assert "icon" in cat
        
        # Verify expected categories exist
        category_ids = [c["id"] for c in categories]
        expected_categories = ["price_negotiation", "trade_in", "objection_handling", 
                              "follow_up", "competitor", "financing", "features", 
                              "closing", "general"]
        for expected in expected_categories:
            assert expected in category_ids, f"Missing category: {expected}"


class TestHealthEndpoint:
    """Test health endpoint to verify server is running"""
    
    def test_health_check(self):
        """Test GET /api/health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
