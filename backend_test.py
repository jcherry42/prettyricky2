#!/usr/bin/env python3
"""
Comprehensive Backend Test Suite for Supercharg'd Automotive Sales Middleware
Tests all 11 feature groups as specified in the review request.
All routes are prefixed with /api and tested against http://localhost:8001
"""

import requests
import json
import time
import uuid
import base64
from typing import Dict, Any, List, Tuple
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Test configuration
BACKEND_URL = "http://localhost:8001"
TIMEOUT = 30  # seconds

class BackendTester:
    def __init__(self):
        self.results = []
        self.session = requests.Session()
        self.test_customer_id = None
        
    def log_result(self, group: str, endpoint: str, method: str, status_code: int, 
                   success: bool, response_data: Any = None, error: str = None):
        """Log a test result"""
        result = {
            'group': group,
            'endpoint': endpoint,
            'method': method,
            'status_code': status_code,
            'success': success,
            'response_data': response_data,
            'error': error,
            'timestamp': time.time()
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        logger.info(f"{status} [{group}] {method} {endpoint} -> {status_code}")
        if error:
            logger.error(f"    Error: {error}")

    def make_request(self, method: str, endpoint: str, **kwargs) -> Tuple[int, Dict]:
        """Make HTTP request and return status code and response data"""
        url = f"{BACKEND_URL}{endpoint}"
        try:
            response = self.session.request(method, url, timeout=TIMEOUT, **kwargs)
            try:
                data = response.json()
            except:
                data = response.text
            return response.status_code, data
        except Exception as e:
            return 0, {"error": str(e)}

    # GROUP 1: INFRASTRUCTURE
    def test_infrastructure(self):
        """Test infrastructure endpoints"""
        logger.info("🔧 Testing GROUP 1: INFRASTRUCTURE")
        
        # Health check
        status_code, data = self.make_request("GET", "/api/health")
        success = status_code == 200 and isinstance(data, dict) and data.get("status") == "healthy"
        self.log_result("Infrastructure", "/api/health", "GET", status_code, success, data)
        
        # Auth status
        status_code, data = self.make_request("GET", "/api/auth/status")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Infrastructure", "/api/auth/status", "GET", status_code, success, data)
        
        # AI Gateway statistics
        status_code, data = self.make_request("GET", "/api/ai/stats")
        success = status_code == 200 and isinstance(data, dict)
        if success and isinstance(data, dict):
            # Check for expected keys
            expected_keys = ["features", "cache", "circuit_breakers", "model_routes"]
            success = all(key in data for key in expected_keys)
        self.log_result("Infrastructure", "/api/ai/stats", "GET", status_code, success, data)

    # GROUP 2: AI FEATURES (HIGH PRIORITY)
    def test_ai_features(self):
        """Test AI feature endpoints - core functionality"""
        logger.info("🤖 Testing GROUP 2: AI FEATURES (HIGH PRIORITY)")
        
        # Tower Talk - financing inquiry
        tower_talk_payload = {
            "situation": "Customer interested in a 2024 BMW X5, asking about monthly payments",
            "inquiryType": "financing",
            "context": {
                "customerName": "Marcus",
                "vehicle": "2024 BMW X5 xDrive40i",
                "vehiclePrice": "$65,000",
                "dealershipName": "Prestige Motors",
                "salespersonName": "Jake Thompson"
            }
        }
        status_code, data = self.make_request("POST", "/api/tower-talk", json=tower_talk_payload)
        success = status_code == 200 and isinstance(data, dict)
        if success:
            # Check response content - expect 2-3 sentences, no emojis
            response_text = data.get("response", "")
            success = len(response_text) > 0 and "💰" not in response_text  # Basic emoji check
        self.log_result("AI Features", "/api/tower-talk", "POST", status_code, success, data)
        
        # Tower Talk - appointment setting (new type)
        appointment_payload = {
            "situation": "Internet lead submitted form about 2024 Toyota Camry",
            "inquiryType": "appointment_setting", 
            "context": {
                "customerName": "Sarah",
                "vehicle": "2024 Toyota Camry XSE",
                "dealershipName": "AutoNation",
                "salespersonName": "Chris"
            }
        }
        status_code, data = self.make_request("POST", "/api/tower-talk", json=appointment_payload)
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("AI Features", "/api/tower-talk", "POST", status_code, success, data)
        
        # Translation
        translate_payload = {
            "text": "I would like to schedule a test drive for the 2024 Mercedes GLE",
            "target_lang": "es"
        }
        status_code, data = self.make_request("POST", "/api/translate", json=translate_payload)
        success = status_code == 200 and isinstance(data, dict) and "translated_text" in data
        self.log_result("AI Features", "/api/translate", "POST", status_code, success, data)
        
        # TTS
        tts_payload = {
            "text": "Welcome to Prestige Motors",
            "voice": "alloy"
        }
        status_code, data = self.make_request("POST", "/api/tts", json=tts_payload)
        success = status_code == 200 and isinstance(data, dict)
        if success:
            # Check for audio response
            success = "audio_base64" in data or "audio_url" in data
        self.log_result("AI Features", "/api/tts", "POST", status_code, success, data)
        
        # Voice Translate - error handling test (empty audio)
        status_code, data = self.make_request("POST", "/api/voice-translate")
        success = status_code == 422  # Expected error
        self.log_result("AI Features", "/api/voice-translate", "POST", status_code, success, data)

    # GROUP 3: VECTOR SEARCH / KNOWLEDGE BASE
    def test_knowledge_base(self):
        """Test vector search and knowledge base functionality"""
        logger.info("🔍 Testing GROUP 3: VECTOR SEARCH / KNOWLEDGE BASE")
        
        # Knowledge stats
        status_code, data = self.make_request("GET", "/api/knowledge/stats")
        success = status_code == 200 and isinstance(data, dict)
        if success:
            # Expect knowledge_entries >= 32, 10 categories
            knowledge_entries = data.get("knowledge_entries", 0)
            categories = len(data.get("knowledge_categories", {}))  # Count categories properly
            success = knowledge_entries >= 32 and categories >= 10
        self.log_result("Knowledge Base", "/api/knowledge/stats", "GET", status_code, success, data)
        
        # Knowledge search - objection handling
        search_payload = {
            "query": "customer says price is too high how to handle",
            "top_k": 5
        }
        status_code, data = self.make_request("POST", "/api/knowledge/search", json=search_payload)
        success = status_code == 200 and isinstance(data, dict) and "results" in data
        self.log_result("Knowledge Base", "/api/knowledge/search", "POST", status_code, success, data)
        
        # Knowledge search with category filter
        category_search_payload = {
            "query": "setting appointment for test drive",
            "category": "appointment_setting",
            "top_k": 3
        }
        status_code, data = self.make_request("POST", "/api/knowledge/search", json=category_search_payload)
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Knowledge Base", "/api/knowledge/search", "POST", status_code, success, data)
        
        # Follow-up knowledge
        followup_payload = {
            "query": "follow up one week after visit",
            "top_k": 3
        }
        status_code, data = self.make_request("POST", "/api/knowledge/search", json=followup_payload)
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Knowledge Base", "/api/knowledge/search", "POST", status_code, success, data)
        
        # Knowledge seed - idempotent
        status_code, data = self.make_request("POST", "/api/knowledge/seed")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Knowledge Base", "/api/knowledge/seed", "POST", status_code, success, data)

    # GROUP 4: TELEMETRY
    def test_telemetry(self):
        """Test telemetry tracking functionality"""
        logger.info("📊 Testing GROUP 4: TELEMETRY")
        
        # Track AI usage
        track_payload = {
            "category": "ai_usage",
            "action": "tower_talk_generate",
            "properties": {
                "inquiry_type": "objection",
                "latency_ms": 850
            },
            "session_id": "audit-001"
        }
        status_code, data = self.make_request("POST", "/api/telemetry/track", json=track_payload)
        success = status_code == 200 and isinstance(data, dict) and data.get("tracked") == True
        self.log_result("Telemetry", "/api/telemetry/track", "POST", status_code, success, data)
        
        # Track sales flow
        sales_track_payload = {
            "category": "sales_flow",
            "action": "appointment_set",
            "properties": {
                "customer": "test"
            },
            "session_id": "audit-001"
        }
        status_code, data = self.make_request("POST", "/api/telemetry/track", json=sales_track_payload)
        success = status_code == 200 and isinstance(data, dict) and data.get("tracked") == True
        self.log_result("Telemetry", "/api/telemetry/track", "POST", status_code, success, data)
        
        # Telemetry summary
        status_code, data = self.make_request("GET", "/api/telemetry/summary?hours=24")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Telemetry", "/api/telemetry/summary", "GET", status_code, success, data)
        
        # Sales funnel
        status_code, data = self.make_request("GET", "/api/telemetry/sales-funnel?days=30")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Telemetry", "/api/telemetry/sales-funnel", "GET", status_code, success, data)
        
        # AI usage stats
        status_code, data = self.make_request("GET", "/api/telemetry/ai-usage?days=7")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Telemetry", "/api/telemetry/ai-usage", "GET", status_code, success, data)

    # GROUP 5: CUSTOMER CRUD
    def test_customer_crud(self):
        """Test customer management operations"""
        logger.info("👥 Testing GROUP 5: CUSTOMER CRUD")
        
        # List customers
        status_code, data = self.make_request("GET", "/api/customers/list")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Customer CRUD", "/api/customers/list", "GET", status_code, success, data)
        
        # Customer stats
        status_code, data = self.make_request("GET", "/api/customers/stats")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Customer CRUD", "/api/customers/stats", "GET", status_code, success, data)
        
        # Create customer
        create_payload = {
            "first_name": "Test", 
            "last_name": "Audit",
            "phone": "555-0199",
            "email": "audit@test.com",
            "status": "active"
        }
        status_code, data = self.make_request("POST", "/api/customers/create", json=create_payload)
        success = status_code in [200, 201] and isinstance(data, dict)
        if success and "customer_id" in data:
            self.test_customer_id = data["customer_id"]
        self.log_result("Customer CRUD", "/api/customers/create", "POST", status_code, success, data)
        
        # Get all customers to verify creation
        status_code, data = self.make_request("GET", "/api/customers")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Customer CRUD", "/api/customers", "GET", status_code, success, data)
        
        # Update customer if ID available
        if self.test_customer_id:
            update_payload = {
                "first_name": "Updated",
                "notes": "Test customer updated during audit"
            }
            status_code, data = self.make_request("PATCH", f"/api/customers/{self.test_customer_id}", json=update_payload)
            success = status_code == 200 and isinstance(data, dict)
            self.log_result("Customer CRUD", f"/api/customers/{self.test_customer_id}", "PATCH", status_code, success, data)

    # GROUP 6: VEHICLES
    def test_vehicles(self):
        """Test vehicle endpoints"""
        logger.info("🚗 Testing GROUP 6: VEHICLES")
        
        # List vehicles
        status_code, data = self.make_request("GET", "/api/vehicles")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Vehicles", "/api/vehicles", "GET", status_code, success, data)
        
        # Vehicle stats
        status_code, data = self.make_request("GET", "/api/vehicles/stats")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Vehicles", "/api/vehicles/stats", "GET", status_code, success, data)
        
        # Vehicle inventory
        status_code, data = self.make_request("GET", "/api/vehicles/inventory")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Vehicles", "/api/vehicles/inventory", "GET", status_code, success, data)

    # GROUP 7: ANALYTICS
    def test_analytics(self):
        """Test analytics endpoints"""
        logger.info("📈 Testing GROUP 7: ANALYTICS")
        
        # Dashboard analytics
        status_code, data = self.make_request("GET", "/api/analytics/dashboard")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Analytics", "/api/analytics/dashboard", "GET", status_code, success, data)
        
        # Sales analytics
        status_code, data = self.make_request("GET", "/api/analytics/sales")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Analytics", "/api/analytics/sales", "GET", status_code, success, data)
        
        # Customer analytics
        status_code, data = self.make_request("GET", "/api/analytics/customers")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Analytics", "/api/analytics/customers", "GET", status_code, success, data)
        
        # Inventory analytics
        status_code, data = self.make_request("GET", "/api/analytics/inventory")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Analytics", "/api/analytics/inventory", "GET", status_code, success, data)
        
        # Conversation analytics
        status_code, data = self.make_request("GET", "/api/analytics/conversations")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Analytics", "/api/analytics/conversations", "GET", status_code, success, data)

    # GROUP 8: VIN / LICENSE
    def test_vin_license(self):
        """Test VIN decoding and license endpoints"""
        logger.info("🔍 Testing GROUP 8: VIN / LICENSE")
        
        # VIN decode - Honda Accord sample
        status_code, data = self.make_request("GET", "/api/vin/decode/1HGCM82633A004352")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("VIN/License", "/api/vin/decode/1HGCM82633A004352", "GET", status_code, success, data)
        
        # Trade-in count
        status_code, data = self.make_request("GET", "/api/vin/trade-in-count")
        success = status_code == 200 and isinstance(data, dict)
        if success:
            # Check for expected fields
            expected_fields = ["count", "cap", "remaining", "at_limit"]
            success = all(field in data for field in expected_fields)
        self.log_result("VIN/License", "/api/vin/trade-in-count", "GET", status_code, success, data)

    # GROUP 9: CONVERSATIONS
    def test_conversations(self):
        """Test conversation endpoints"""
        logger.info("💬 Testing GROUP 9: CONVERSATIONS")
        
        # List conversations
        status_code, data = self.make_request("GET", "/api/conversations")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Conversations", "/api/conversations", "GET", status_code, success, data)
        
        # Conversation stats
        status_code, data = self.make_request("GET", "/api/conversations/stats")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Conversations", "/api/conversations/stats", "GET", status_code, success, data)
        
        # Conversation categories
        status_code, data = self.make_request("GET", "/api/conversations/categories")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Conversations", "/api/conversations/categories", "GET", status_code, success, data)

    # GROUP 10: PRINT CENTER
    def test_print_center(self):
        """Test print functionality"""
        logger.info("🖨️ Testing GROUP 10: PRINT CENTER")
        
        # Print preview
        preview_payload = {
            "type": "vehicle",
            "vin": "1HGCM82633A004352",
            "year": "2024",
            "make": "BMW",
            "model": "X5"
        }
        status_code, data = self.make_request("POST", "/api/print/preview", json=preview_payload)
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Print Center", "/api/print/preview", "POST", status_code, success, data)

    # GROUP 11: MISC
    def test_misc(self):
        """Test miscellaneous endpoints"""
        logger.info("🔧 Testing GROUP 11: MISC")
        
        # Dashboard stats
        status_code, data = self.make_request("GET", "/api/dashboard/stats")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Misc", "/api/dashboard/stats", "GET", status_code, success, data)
        
        # Data sources
        status_code, data = self.make_request("GET", "/api/data-sources")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Misc", "/api/data-sources", "GET", status_code, success, data)
        
        # Webhooks
        status_code, data = self.make_request("GET", "/api/webhooks")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Misc", "/api/webhooks", "GET", status_code, success, data)
        
        # Integrations
        status_code, data = self.make_request("GET", "/api/integrations")
        success = status_code == 200 and isinstance(data, dict)
        self.log_result("Misc", "/api/integrations", "GET", status_code, success, data)

    def cleanup(self):
        """Clean up test data"""
        if self.test_customer_id:
            status_code, _ = self.make_request("DELETE", f"/api/customers/{self.test_customer_id}")
            logger.info(f"Cleaned up test customer: {self.test_customer_id} (status: {status_code})")

    def run_all_tests(self):
        """Run all test groups"""
        logger.info("🚀 Starting Comprehensive Backend Audit")
        logger.info(f"Backend URL: {BACKEND_URL}")
        
        start_time = time.time()
        
        # Run all test groups
        self.test_infrastructure()
        self.test_ai_features()
        self.test_knowledge_base()
        self.test_telemetry()
        self.test_customer_crud()
        self.test_vehicles()
        self.test_analytics()
        self.test_vin_license()
        self.test_conversations()
        self.test_print_center()
        self.test_misc()
        
        # Cleanup
        self.cleanup()
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Generate summary
        self.generate_summary(total_time)

    def generate_summary(self, total_time: float):
        """Generate test summary"""
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['success'])
        failed_tests = total_tests - passed_tests
        pass_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0
        
        logger.info("="*80)
        logger.info("🎯 COMPREHENSIVE BACKEND AUDIT RESULTS")
        logger.info("="*80)
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"Passed: {passed_tests}")
        logger.info(f"Failed: {failed_tests}")
        logger.info(f"Pass Rate: {pass_rate:.1f}%")
        logger.info(f"Total Time: {total_time:.2f}s")
        logger.info("="*80)
        
        # Group by status
        failed_by_group = {}
        passed_by_group = {}
        
        for result in self.results:
            group = result['group']
            if result['success']:
                if group not in passed_by_group:
                    passed_by_group[group] = []
                passed_by_group[group].append(result)
            else:
                if group not in failed_by_group:
                    failed_by_group[group] = []
                failed_by_group[group].append(result)
        
        # Report failures first (detailed)
        if failed_by_group:
            logger.error("❌ FAILED TESTS (DETAILED):")
            for group, failures in failed_by_group.items():
                logger.error(f"  [{group}]:")
                for failure in failures:
                    logger.error(f"    {failure['method']} {failure['endpoint']} -> {failure['status_code']}")
                    if failure['error']:
                        logger.error(f"      Error: {failure['error']}")
        
        # Report successes (concise)
        if passed_by_group:
            logger.info("✅ PASSED TESTS (BY GROUP):")
            for group, successes in passed_by_group.items():
                logger.info(f"  [{group}]: {len(successes)} tests passed")

        return {
            'total_tests': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'pass_rate': pass_rate,
            'total_time': total_time,
            'results': self.results,
            'failed_by_group': failed_by_group,
            'passed_by_group': passed_by_group
        }

if __name__ == "__main__":
    tester = BackendTester()
    summary = tester.run_all_tests()