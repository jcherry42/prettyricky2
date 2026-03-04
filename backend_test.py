#!/usr/bin/env python3
"""
Comprehensive Backend Regression Test for Supercharg'd Automotive Mobile App
Target: >90% pass rate across ALL critical endpoints

Tests 15 endpoints exactly as specified in the review request:
1. GET /api/health
2. POST /api/translate (3 tests: EN→ES, EN→FR, EN→KO)
3. POST /api/tts
4. POST /api/tower-talk  
5. POST /api/customers/create
6. GET /api/customers/list?limit=5
7. GET /api/vin/decode/JM3KKEHA3T1355103
8. GET /api/vin/trade-in-count
9. GET /api/dashboard/stats
10. POST /api/voice-translate (invalid payload)
11. POST /api/license/parse-pdf417
12. GET /api/vehicles/inventory
13. DELETE customer (cleanup)
"""

import requests
import json
import time
import base64
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = "https://ios-android-polish.preview.emergentagent.com"
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

    def run_all_tests(self):
        """Run all 15 tests as specified in the review request"""
        print(f"🎯 SUPERCHARG'D AUTOMOTIVE MOBILE APP - COMPREHENSIVE BACKEND REGRESSION TEST")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Target: >90% pass rate across ALL critical endpoints\n")
        
        # Run tests in order
        tests = [
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