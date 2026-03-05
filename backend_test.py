#!/usr/bin/env python3
"""
Comprehensive Backend Regression Test for Supercharg'd Automotive Mobile App
MASSIVE ARCHITECTURE REFACTOR VERIFICATION: server.py decomposed from 3,604 to 1,460 lines

Tests ALL critical endpoints after extraction into 5 new route modules:
- routes/tts_voice.py (TTS + Voice Translate — now with MongoDB TTS cache)
- routes/ai_features.py (Vision, VIN OCR, A/B testing, Conversations, Analytics)  
- routes/data_management.py (Import, Data Sources, CRM configs, Dashboard stats, Maintenance, Favorites)
- routes/integrations_routes.py (Full integrations, field discovery, transforms, profiles, webhooks)
- middleware/correlation.py (X-Correlation-ID header on all requests)

Target: >90% pass rate across ALL 22 comprehensive test scenarios

Core Tests (1-15 from original review):
1. GET /api/health → should return {status: "healthy"}
2-4. POST /api/translate → EN→ES/FR/KO should return translated_text
5. POST /api/tts → text="Welcome" should return audio_base64
6. POST /api/tower-talk → scenario should return response
7-8. Customer CRUD → create/list should work with proper structure  
9. GET /api/vin/decode/JM3KKEHA3T1355103 → should return Mazda CX-90 data
10. GET /api/vin/trade-in-count → should return {count, cap, remaining}
11. GET /api/dashboard/stats → should return customer/vehicle stats
12. POST /api/voice-translate → invalid data should handle gracefully
13. POST /api/license/parse-pdf417 → test with invalid data
14. GET /api/vehicles/inventory → should return inventory data

Extracted Endpoint Tests (16-20):
15. GET /api/favorites/categories → should return category list (EXTRACTED endpoint)
16. GET /api/ab/experiments → should return experiments list (EXTRACTED endpoint)  
17. GET /api/conversations/categories → should return category list (EXTRACTED endpoint)
18. GET /api/analytics/dashboard → should return analytics data (EXTRACTED endpoint)
19. GET /api/integrations/adapters → should return adapter list (EXTRACTED endpoint)

Architecture Verification Tests (21-22):
20. TTS MongoDB Cache → Second call should return cached=true (MongoDB cache working)
21. X-Correlation-ID → ALL responses should include correlation ID header (middleware working)
22. Customer Pagination → Should include has_more and next_cursor fields (new pagination)
"""

import requests
import json
import time
import base64
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = "https://rolls-royce-ts.preview.emergentagent.com"
TIMEOUT = 30

class BackendTester:
    def __init__(self):
        self.test_results = []
        self.created_customer_id = None
        self.session = requests.Session()
        
    def log_result(self, test_name: str, status: str, response_time: float, 
                   status_code: Optional[int] = None, details: str = ""):
        """Log test result"""
        result = {
            "test": test_name,
            "status": status,
            "response_time": f"{response_time:.2f}ms",
            "status_code": status_code,
            "details": details
        }
        self.test_results.append(result)
        
        # Print immediate feedback
        status_symbol = "✅" if status == "PASS" else "❌"
        print(f"{status_symbol} {test_name} - {status} ({response_time:.0f}ms) {details}")
        
    def make_request(self, method: str, endpoint: str, **kwargs) -> tuple:
        """Make HTTP request and measure response time"""
        url = f"{BACKEND_URL}{endpoint}"
        start_time = time.time()
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, timeout=TIMEOUT, **kwargs)
            elif method.upper() == "POST":
                response = self.session.post(url, timeout=TIMEOUT, **kwargs)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, timeout=TIMEOUT, **kwargs)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            response_time = (time.time() - start_time) * 1000
            return response, response_time
            
        except requests.exceptions.Timeout:
            response_time = (time.time() - start_time) * 1000
            return None, response_time
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            return None, response_time

    def test_health_check(self):
        """Test 1: GET /api/health — expect status 200, "healthy" status"""
        response, response_time = self.make_request("GET", "/api/health")
        
        if response is None:
            self.log_result("Health Check", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200 and data.get("status") == "healthy":
                self.log_result("Health Check", "PASS", response_time, 200, "Status healthy")
            else:
                self.log_result("Health Check", "FAIL", response_time, response.status_code, 
                               f"Expected healthy status, got: {data}")
        except Exception as e:
            self.log_result("Health Check", "FAIL", response_time, response.status_code, 
                           f"JSON parse error: {str(e)}")

    def test_translate_en_to_es(self):
        """Test 2a: POST /api/translate — EN→ES"""
        payload = {
            "text": "Hello",
            "source_language": "en", 
            "target_language": "es"
        }
        
        response, response_time = self.make_request("POST", "/api/translate", 
                                                   json=payload,
                                                   headers={"Content-Type": "application/json"})
        
        if response is None:
            self.log_result("Translate EN→ES", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200 and "translated_text" in data:
                translated = data["translated_text"]
                self.log_result("Translate EN→ES", "PASS", response_time, 200, 
                               f"'Hello' → '{translated}'")
            else:
                self.log_result("Translate EN→ES", "FAIL", response_time, response.status_code,
                               f"Expected translated_text field, got: {data}")
        except Exception as e:
            self.log_result("Translate EN→ES", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_translate_en_to_fr(self):
        """Test 2b: POST /api/translate — EN→FR"""
        payload = {
            "text": "Test drive?",
            "source_language": "en",
            "target_language": "fr"
        }
        
        response, response_time = self.make_request("POST", "/api/translate",
                                                   json=payload,
                                                   headers={"Content-Type": "application/json"})
        
        if response is None:
            self.log_result("Translate EN→FR", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200 and "translated_text" in data:
                translated = data["translated_text"]
                self.log_result("Translate EN→FR", "PASS", response_time, 200,
                               f"'Test drive?' → '{translated}'")
            else:
                self.log_result("Translate EN→FR", "FAIL", response_time, response.status_code,
                               f"Expected translated_text field, got: {data}")
        except Exception as e:
            self.log_result("Translate EN→FR", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_translate_en_to_ko(self):
        """Test 2c: POST /api/translate — EN→KO"""
        payload = {
            "text": "Financing",
            "source_language": "en",
            "target_language": "ko"
        }
        
        response, response_time = self.make_request("POST", "/api/translate",
                                                   json=payload,
                                                   headers={"Content-Type": "application/json"})
        
        if response is None:
            self.log_result("Translate EN→KO", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200 and "translated_text" in data:
                translated = data["translated_text"]
                self.log_result("Translate EN→KO", "PASS", response_time, 200,
                               f"'Financing' → '{translated}'")
            else:
                self.log_result("Translate EN→KO", "FAIL", response_time, response.status_code,
                               f"Expected translated_text field, got: {data}")
        except Exception as e:
            self.log_result("Translate EN→KO", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_tts(self):
        """Test 3: POST /api/tts — expect audio_base64 field"""
        payload = {
            "text": "Welcome",
            "language": "en"
        }
        
        response, response_time = self.make_request("POST", "/api/tts",
                                                   json=payload,
                                                   headers={"Content-Type": "application/json"})
        
        if response is None:
            self.log_result("Text-to-Speech", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200 and "audio_base64" in data:
                audio_len = len(data["audio_base64"])
                self.log_result("Text-to-Speech", "PASS", response_time, 200,
                               f"Audio generated ({audio_len} chars)")
            else:
                self.log_result("Text-to-Speech", "FAIL", response_time, response.status_code,
                               f"Expected audio_base64 field, got: {data}")
        except Exception as e:
            self.log_result("Text-to-Speech", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_tower_talk(self):
        """Test 4: POST /api/tower-talk — expect response field"""
        payload = {
            "situation": "What's the price of this Mercedes GLE 450?",
            "context": {"customerName": "John", "inquiryType": "pricing"}
        }
        
        response, response_time = self.make_request("POST", "/api/tower-talk",
                                                   json=payload,
                                                   headers={"Content-Type": "application/json"})
        
        if response is None:
            self.log_result("Tower Talk AI", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200 and "response" in data:
                response_len = len(data["response"])
                self.log_result("Tower Talk AI", "PASS", response_time, 200,
                               f"AI response generated ({response_len} chars)")
            else:
                self.log_result("Tower Talk AI", "FAIL", response_time, response.status_code,
                               f"Expected response field, got: {data}")
        except Exception as e:
            self.log_result("Tower Talk AI", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_customer_create(self):
        """Test 5: POST /api/customers/create — expect 201 status"""
        payload = {
            "first_name": "Test",
            "last_name": "User",
            "phone": "555-0101"
        }
        
        response, response_time = self.make_request("POST", "/api/customers/create",
                                                   json=payload,
                                                   headers={"Content-Type": "application/json"})
        
        if response is None:
            self.log_result("Customer Create", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 201:
                # Extract customer ID for later deletion
                if "customer" in data and "id" in data["customer"]:
                    self.created_customer_id = data["customer"]["id"]
                elif "id" in data:
                    self.created_customer_id = data["id"]
                elif "customer_id" in data:
                    self.created_customer_id = data["customer_id"]
                    
                self.log_result("Customer Create", "PASS", response_time, 201,
                               f"Customer created with ID: {self.created_customer_id}")
            else:
                self.log_result("Customer Create", "FAIL", response_time, response.status_code,
                               f"Expected 201 status, got {response.status_code}: {data}")
        except Exception as e:
            self.log_result("Customer Create", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_customer_list(self):
        """Test 6: GET /api/customers/list?limit=5 — expect {customers: [...], total: N}"""
        response, response_time = self.make_request("GET", "/api/customers/list?limit=5")
        
        if response is None:
            self.log_result("Customer List", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if (response.status_code == 200 and 
                "customers" in data and 
                "total" in data and
                isinstance(data["customers"], list)):
                
                customer_count = len(data["customers"])
                total = data["total"]
                self.log_result("Customer List", "PASS", response_time, 200,
                               f"Retrieved {customer_count} customers, total: {total}")
            else:
                self.log_result("Customer List", "FAIL", response_time, response.status_code,
                               f"Expected customers array and total, got: {data}")
        except Exception as e:
            self.log_result("Customer List", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_vin_decode(self):
        """Test 7: GET /api/vin/decode/JM3KKEHA3T1355103 — expect Mazda CX-90 data"""
        response, response_time = self.make_request("GET", "/api/vin/decode/JM3KKEHA3T1355103")
        
        if response is None:
            self.log_result("VIN Decode", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200:
                # Check for Mazda CX-90 data
                make = data.get("make", "").upper()
                model = data.get("model", "").upper() 
                year = data.get("year", "")
                
                if "MAZDA" in make and "CX-90" in model:
                    self.log_result("VIN Decode", "PASS", response_time, 200,
                                   f"Decoded: {year} {make} {model}")
                else:
                    self.log_result("VIN Decode", "FAIL", response_time, 200,
                                   f"Expected Mazda CX-90, got: {make} {model}")
            else:
                self.log_result("VIN Decode", "FAIL", response_time, response.status_code,
                               f"VIN decode failed: {data}")
        except Exception as e:
            self.log_result("VIN Decode", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_vin_trade_in_count(self):
        """Test 8: GET /api/vin/trade-in-count — expect {count, cap, remaining, at_limit}"""
        response, response_time = self.make_request("GET", "/api/vin/trade-in-count")
        
        if response is None:
            self.log_result("VIN Trade-in Count", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if (response.status_code == 200 and
                "count" in data and
                "cap" in data and 
                "remaining" in data and
                "at_limit" in data):
                
                count = data["count"]
                cap = data["cap"]
                remaining = data["remaining"]
                at_limit = data["at_limit"]
                self.log_result("VIN Trade-in Count", "PASS", response_time, 200,
                               f"Count: {count}/{cap}, remaining: {remaining}, at_limit: {at_limit}")
            else:
                self.log_result("VIN Trade-in Count", "FAIL", response_time, response.status_code,
                               f"Expected count/cap/remaining/at_limit, got: {data}")
        except Exception as e:
            self.log_result("VIN Trade-in Count", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_dashboard_stats(self):
        """Test 9: GET /api/dashboard/stats — expect 200"""
        response, response_time = self.make_request("GET", "/api/dashboard/stats")
        
        if response is None:
            self.log_result("Dashboard Stats", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200:
                self.log_result("Dashboard Stats", "PASS", response_time, 200,
                               f"Stats retrieved successfully")
            else:
                self.log_result("Dashboard Stats", "FAIL", response_time, response.status_code,
                               f"Dashboard stats failed: {data}")
        except Exception as e:
            self.log_result("Dashboard Stats", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_voice_translate_invalid(self):
        """Test 10: POST /api/voice-translate — with invalid payload — expect 422"""
        # Send invalid payload (missing required fields or wrong format)
        invalid_payload = {"invalid": "data"}
        
        response, response_time = self.make_request("POST", "/api/voice-translate",
                                                   json=invalid_payload,
                                                   headers={"Content-Type": "application/json"})
        
        if response is None:
            self.log_result("Voice Translate Invalid", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 422:
                self.log_result("Voice Translate Invalid", "PASS", response_time, 422,
                               "Correctly rejected invalid payload")
            else:
                self.log_result("Voice Translate Invalid", "FAIL", response_time, response.status_code,
                               f"Expected 422, got {response.status_code}: {data}")
        except Exception as e:
            self.log_result("Voice Translate Invalid", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_license_parse_pdf417(self):
        """Test 11: POST /api/license/parse-pdf417 — with test data — expect proper handling"""
        # Send test PDF417 barcode data
        test_payload = {
            "pdf417_data": "test_barcode_data_invalid"
        }
        
        response, response_time = self.make_request("POST", "/api/license/parse-pdf417",
                                                   json=test_payload,
                                                   headers={"Content-Type": "application/json"})
        
        if response is None:
            self.log_result("License Parse PDF417", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            # Should handle test data gracefully (either success or proper error)
            if response.status_code in [200, 400, 422]:
                self.log_result("License Parse PDF417", "PASS", response_time, response.status_code,
                               "Endpoint handles test data properly")
            else:
                self.log_result("License Parse PDF417", "FAIL", response_time, response.status_code,
                               f"Unexpected status: {data}")
        except Exception as e:
            self.log_result("License Parse PDF417", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_vehicles_inventory(self):
        """Test 12: GET /api/vehicles/inventory — expect 200"""
        response, response_time = self.make_request("GET", "/api/vehicles/inventory")
        
        if response is None:
            self.log_result("Vehicles Inventory", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200:
                self.log_result("Vehicles Inventory", "PASS", response_time, 200,
                               "Inventory endpoint accessible")
            else:
                self.log_result("Vehicles Inventory", "FAIL", response_time, response.status_code,
                               f"Inventory endpoint failed: {data}")
        except Exception as e:
            self.log_result("Vehicles Inventory", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_customer_delete(self):
        """Test 13: DELETE the customer created in test #7"""
        if not self.created_customer_id:
            self.log_result("Customer Delete", "FAIL", 0, None, "No customer ID to delete")
            return
            
        response, response_time = self.make_request("DELETE", f"/api/customers/{self.created_customer_id}")
        
        if response is None:
            self.log_result("Customer Delete", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            if response.status_code in [200, 204]:
                self.log_result("Customer Delete", "PASS", response_time, response.status_code,
                               f"Customer {self.created_customer_id} deleted")
            else:
                data = response.json() if response.text else "No response body"
                self.log_result("Customer Delete", "FAIL", response_time, response.status_code,
                               f"Delete failed: {data}")
        except Exception as e:
            self.log_result("Customer Delete", "FAIL", response_time, response.status_code,
                           f"Error: {str(e)}")

    def test_favorites_categories(self):
        """Test 14: GET /api/favorites/categories — extracted endpoint"""
        response, response_time = self.make_request("GET", "/api/favorites/categories")
        
        if response is None:
            self.log_result("Favorites Categories", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200 and "categories" in data:
                categories_count = len(data.get("categories", []))
                self.log_result("Favorites Categories", "PASS", response_time, 200,
                               f"Retrieved {categories_count} categories")
            else:
                self.log_result("Favorites Categories", "FAIL", response_time, response.status_code,
                               f"Expected categories list, got: {data}")
        except Exception as e:
            self.log_result("Favorites Categories", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_ab_experiments(self):
        """Test 15: GET /api/ab/experiments — extracted endpoint"""
        response, response_time = self.make_request("GET", "/api/ab/experiments")
        
        if response is None:
            self.log_result("A/B Experiments", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200 and "experiments" in data:
                experiments_count = len(data.get("experiments", []))
                self.log_result("A/B Experiments", "PASS", response_time, 200,
                               f"Retrieved {experiments_count} experiments")
            else:
                self.log_result("A/B Experiments", "FAIL", response_time, response.status_code,
                               f"Expected experiments list, got: {data}")
        except Exception as e:
            self.log_result("A/B Experiments", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_conversations_categories(self):
        """Test 16: GET /api/conversations/categories — extracted endpoint"""
        response, response_time = self.make_request("GET", "/api/conversations/categories")
        
        if response is None:
            self.log_result("Conversation Categories", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200 and "categories" in data:
                categories_count = len(data.get("categories", []))
                self.log_result("Conversation Categories", "PASS", response_time, 200,
                               f"Retrieved {categories_count} categories")
            else:
                self.log_result("Conversation Categories", "FAIL", response_time, response.status_code,
                               f"Expected categories list, got: {data}")
        except Exception as e:
            self.log_result("Conversation Categories", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_analytics_dashboard(self):
        """Test 17: GET /api/analytics/dashboard — extracted endpoint"""
        response, response_time = self.make_request("GET", "/api/analytics/dashboard")
        
        if response is None:
            self.log_result("Analytics Dashboard", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200:
                self.log_result("Analytics Dashboard", "PASS", response_time, 200,
                               "Analytics data retrieved")
            else:
                self.log_result("Analytics Dashboard", "FAIL", response_time, response.status_code,
                               f"Analytics dashboard failed: {data}")
        except Exception as e:
            self.log_result("Analytics Dashboard", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_integrations_adapters(self):
        """Test 18: GET /api/integrations/adapters — extracted endpoint"""
        response, response_time = self.make_request("GET", "/api/integrations/adapters")
        
        if response is None:
            self.log_result("Integrations Adapters", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200:
                self.log_result("Integrations Adapters", "PASS", response_time, 200,
                               "Adapter list retrieved")
            else:
                self.log_result("Integrations Adapters", "FAIL", response_time, response.status_code,
                               f"Adapters endpoint failed: {data}")
        except Exception as e:
            self.log_result("Integrations Adapters", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def test_tts_caching_verification(self):
        """Test 19: Verify TTS caching with MongoDB (second call should be cached=true)"""
        payload = {
            "text": "Welcome to Supercharg'd",
            "language": "en"
        }
        
        # Make the same TTS request twice to test caching
        response1, response_time1 = self.make_request("POST", "/api/tts",
                                                     json=payload,
                                                     headers={"Content-Type": "application/json"})
        
        if response1 is None:
            self.log_result("TTS Caching First Call", "FAIL", response_time1, None, "Request failed/timeout")
            return
            
        time.sleep(0.2)  # Small delay
        
        response2, response_time2 = self.make_request("POST", "/api/tts",
                                                     json=payload,
                                                     headers={"Content-Type": "application/json"})
        
        if response2 is None:
            self.log_result("TTS Caching Verification", "FAIL", response_time2, None, "Second request failed/timeout")
            return
            
        try:
            data1 = response1.json()
            data2 = response2.json()
            
            if (response1.status_code == 200 and response2.status_code == 200 and
                "audio_base64" in data1 and "audio_base64" in data2):
                
                cached_status = data2.get("cached", False)
                if cached_status:
                    self.log_result("TTS Caching Verification", "PASS", response_time2, 200,
                                   f"MongoDB cache working: first={response_time1:.0f}ms, cached={response_time2:.0f}ms")
                else:
                    self.log_result("TTS Caching Verification", "FAIL", response_time2, 200,
                                   f"Cache not working: cached={cached_status}")
            else:
                self.log_result("TTS Caching Verification", "FAIL", response_time2, response2.status_code,
                               f"TTS responses invalid")
        except Exception as e:
            self.log_result("TTS Caching Verification", "FAIL", response_time2, response2.status_code,
                           f"JSON parse error: {str(e)}")

    def test_correlation_id_headers(self):
        """Test 20: Verify X-Correlation-ID header present in responses (middleware verification)"""
        response, response_time = self.make_request("GET", "/api/health")
        
        if response is None:
            self.log_result("Correlation ID Headers", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            correlation_id = response.headers.get("X-Correlation-ID")
            if correlation_id:
                self.log_result("Correlation ID Headers", "PASS", response_time, response.status_code,
                               f"X-Correlation-ID present: {correlation_id[:8]}...")
            else:
                headers_info = ", ".join([f"{k}" for k in response.headers.keys()][:5])
                self.log_result("Correlation ID Headers", "FAIL", response_time, response.status_code,
                               f"X-Correlation-ID missing. Headers: {headers_info}")
        except Exception as e:
            self.log_result("Correlation ID Headers", "FAIL", response_time, response.status_code,
                           f"Error checking headers: {str(e)}")

    def test_customer_pagination(self):
        """Test 21: Verify new customer pagination (has_more, next_cursor fields)"""
        # Test with limit to trigger pagination fields
        response, response_time = self.make_request("GET", "/api/customers/list?limit=1")
        
        if response is None:
            self.log_result("Customer Pagination", "FAIL", response_time, None, "Request failed/timeout")
            return
            
        try:
            data = response.json()
            if response.status_code == 200 and "customers" in data:
                # Check for new pagination fields
                has_more = "has_more" in data
                next_cursor = "next_cursor" in data
                
                if has_more and next_cursor:
                    self.log_result("Customer Pagination", "PASS", response_time, 200,
                                   f"New pagination fields present: has_more={data.get('has_more')}, next_cursor exists")
                else:
                    self.log_result("Customer Pagination", "FAIL", response_time, 200,
                                   f"Missing pagination fields: has_more={has_more}, next_cursor={next_cursor}")
            else:
                self.log_result("Customer Pagination", "FAIL", response_time, response.status_code,
                               f"Customer list invalid: {data}")
        except Exception as e:
            self.log_result("Customer Pagination", "FAIL", response_time, response.status_code,
                           f"JSON parse error: {str(e)}")

    def run_all_tests(self):
        """Run comprehensive backend regression test covering ALL extracted routes"""
        print(f"🎯 SUPERCHARG'D AUTOMOTIVE MOBILE APP - COMPREHENSIVE BACKEND REGRESSION TEST")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Target: >90% pass rate across ALL critical endpoints after server.py refactoring")
        print(f"Testing extracted route modules: TTS/Voice, AI Features, Data Management, Integrations")
        print(f"Verifying: MongoDB TTS cache, X-Correlation-ID middleware, new pagination\n")
        
        # Run tests in order - core tests first, then extracted endpoint tests
        tests = [
            # Core original tests
            self.test_health_check,
            self.test_translate_en_to_es,
            self.test_translate_en_to_fr, 
            self.test_translate_en_to_ko,
            self.test_tts,
            self.test_tower_talk,
            self.test_customer_create,
            self.test_customer_list,
            self.test_vin_decode,
            self.test_vin_trade_in_count,
            self.test_dashboard_stats,
            self.test_voice_translate_invalid,
            self.test_license_parse_pdf417,
            self.test_vehicles_inventory,
            # Additional extracted endpoint tests
            self.test_favorites_categories,
            self.test_ab_experiments,
            self.test_conversations_categories,
            self.test_analytics_dashboard,
            self.test_integrations_adapters,
            # Architecture-specific verification tests
            self.test_tts_caching_verification,
            self.test_correlation_id_headers,
            self.test_customer_pagination,
            # Cleanup
            self.test_customer_delete
        ]
        
        for test_func in tests:
            test_func()
            time.sleep(0.5)  # Small delay between tests
        
        # Calculate results
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["status"] == "PASS"])
        pass_rate = (passed_tests / total_tests) * 100
        
        print(f"\n{'='*80}")
        print(f"🎯 COMPREHENSIVE BACKEND REGRESSION TEST RESULTS")
        print(f"{'='*80}")
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Pass Rate: {pass_rate:.1f}%")
        print(f"Target: >90% (Required for production)")
        
        if pass_rate >= 90:
            print(f"\n✅ EXCELLENT - TARGET ACHIEVED ({pass_rate:.1f}% ≥ 90%)")
            print(f"Backend is production-ready for Supercharg'd automotive mobile app")
        else:
            print(f"\n❌ BELOW TARGET ({pass_rate:.1f}% < 90%)")
            print(f"Issues need to be resolved before production deployment")
        
        # Show detailed results
        print(f"\n📊 DETAILED TEST RESULTS:")
        print(f"{'='*80}")
        
        for i, result in enumerate(self.test_results, 1):
            status_symbol = "✅" if result["status"] == "PASS" else "❌"
            print(f"{i:2d}. {status_symbol} {result['test']:<25} {result['status']:<4} "
                  f"({result['response_time']:>8}) {result['details']}")
        
        # Show failures if any
        failures = [r for r in self.test_results if r["status"] == "FAIL"]
        if failures:
            print(f"\n❌ FAILED TESTS REQUIRING ATTENTION:")
            print(f"{'='*80}")
            for failure in failures:
                print(f"• {failure['test']}: {failure['details']}")
        
        return pass_rate >= 90

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)