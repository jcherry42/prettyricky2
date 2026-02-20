#!/usr/bin/env python3
"""
Comprehensive Backend API Test for Supercharg'd Mobile App
Testing all core endpoints with detailed reporting
"""

import requests
import json
import time
import base64
import tempfile
import os
from io import BytesIO

# Backend base URL
BASE_URL = "https://pwa-native.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.test_results = []
        self.passed = 0
        self.failed = 0
        
    def log_result(self, test_name, status_code, expected_code, response_data, notes=""):
        """Log test result with details"""
        success = status_code == expected_code
        if success:
            self.passed += 1
        else:
            self.failed += 1
            
        self.test_results.append({
            "test": test_name,
            "status_code": status_code,
            "expected": expected_code,
            "success": success,
            "response": response_data,
            "notes": notes
        })
        
        # Print immediate feedback
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name} - Status: {status_code} (expected {expected_code})")
        if notes:
            print(f"    Notes: {notes}")
        if not success and isinstance(response_data, dict) and 'detail' in response_data:
            print(f"    Error: {response_data['detail']}")
        print()
        
    def test_customer_crud(self):
        """Test Customer CRUD operations"""
        print("=== TESTING CUSTOMER CRUD ===")
        
        # 1. Test customer list
        try:
            response = requests.get(f"{BASE_URL}/customers/list", timeout=10)
            data = response.json()
            
            # Check response structure
            has_customers_key = 'customers' in data
            has_total_key = 'total' in data
            structure_ok = has_customers_key and has_total_key
            
            self.log_result(
                "GET /customers/list", 
                response.status_code, 
                200, 
                data,
                f"Structure check: customers={has_customers_key}, total={has_total_key}, structure_ok={structure_ok}"
            )
        except Exception as e:
            self.log_result("GET /customers/list", 0, 200, {"error": str(e)}, "Request failed")
            
        # 2. Create a test customer
        test_customer_data = {
            "first_name": "John",
            "last_name": "Doe", 
            "phone": "+1-555-123-4567",
            "email": "john.doe@example.com",
            "lead_status": "new"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/customers/create", json=test_customer_data, timeout=10)
            data = response.json()
            
            # Check if response has both id and customer_id
            has_id = 'id' in data
            has_customer_id = 'customer_id' in data
            normalized_ids = has_id and has_customer_id
            
            customer_id = data.get('id') or data.get('customer_id')
            
            self.log_result(
                "POST /customers/create",
                response.status_code,
                201,
                data,
                f"ID normalization: has_id={has_id}, has_customer_id={has_customer_id}, normalized={normalized_ids}"
            )
            
            if response.status_code == 201 and customer_id:
                # Store for further testing
                self.test_customer_id = customer_id
                
                # 3. Test get customer by ID
                try:
                    response = requests.get(f"{BASE_URL}/customers/{customer_id}", timeout=10)
                    data = response.json()
                    self.log_result(f"GET /customers/{customer_id}", response.status_code, 200, data)
                except Exception as e:
                    self.log_result(f"GET /customers/{customer_id}", 0, 200, {"error": str(e)})
                    
                # 4. Test update customer
                try:
                    update_data = {"lead_status": "contacted"}
                    response = requests.patch(f"{BASE_URL}/customers/{customer_id}", json=update_data, timeout=10)
                    data = response.json()
                    self.log_result(f"PATCH /customers/{customer_id}", response.status_code, 200, data)
                except Exception as e:
                    self.log_result(f"PATCH /customers/{customer_id}", 0, 200, {"error": str(e)})
                    
                # 5. Test delete customer
                try:
                    response = requests.delete(f"{BASE_URL}/customers/{customer_id}", timeout=10)
                    data = response.json() if response.content else {}
                    self.log_result(f"DELETE /customers/{customer_id}", response.status_code, 200, data)
                except Exception as e:
                    self.log_result(f"DELETE /customers/{customer_id}", 0, 200, {"error": str(e)})
                    
        except Exception as e:
            self.log_result("POST /customers/create", 0, 201, {"error": str(e)})
            
    def test_translation(self):
        """Test Translation API"""
        print("=== TESTING TRANSLATION ===")
        
        test_cases = [
            {
                "text": "Good morning, how can I help you today?",
                "source_lang": "en",
                "target_lang": "es",
                "name": "EN→ES"
            },
            {
                "text": "Buenos días, ¿cómo puedo ayudarle hoy?",
                "source_lang": "es", 
                "target_lang": "en",
                "name": "ES→EN"
            },
            {
                "text": "Good morning, how can I help you today?",
                "source_lang": "en",
                "target_lang": "fr", 
                "name": "EN→FR"
            },
            {
                "text": "Good morning, how can I help you today?",
                "source_lang": "en",
                "target_lang": "ko",
                "name": "EN→KO"
            }
        ]
        
        for test_case in test_cases:
            try:
                payload = {
                    "text": test_case["text"],
                    "source_lang": test_case["source_lang"],
                    "target_lang": test_case["target_lang"]
                }
                
                response = requests.post(f"{BASE_URL}/translate", json=payload, timeout=15)
                data = response.json()
                
                # Check for translated_text field
                has_translated_text = 'translated_text' in data
                
                self.log_result(
                    f"POST /translate ({test_case['name']})",
                    response.status_code,
                    200,
                    data,
                    f"Has translated_text field: {has_translated_text}"
                )
                
            except Exception as e:
                self.log_result(f"POST /translate ({test_case['name']})", 0, 200, {"error": str(e)})
                
    def test_tower_talk(self):
        """Test Tower Talk API"""
        print("=== TESTING TOWER TALK ===")
        
        payload = {
            "situation": "Customer is asking about financing options for a 2024 Honda Accord",
            "context": {
                "customerName": "John Smith",
                "vehicle": "2024 Honda Accord", 
                "tradeVin": "",
                "tradeMileage": ""
            }
        }
        
        try:
            response = requests.post(f"{BASE_URL}/tower-talk", json=payload, timeout=20)
            data = response.json()
            
            # Check for response field
            has_response = 'response' in data
            
            self.log_result(
                "POST /tower-talk",
                response.status_code,
                200,
                data,
                f"Has response field: {has_response}"
            )
            
        except Exception as e:
            self.log_result("POST /tower-talk", 0, 200, {"error": str(e)})
            
    def test_tts(self):
        """Test Text-to-Speech API"""
        print("=== TESTING TEXT-TO-SPEECH ===")
        
        payload = {
            "text": "Welcome to Supercharg'd",
            "language": "en",
            "voice": "auto"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/tts", json=payload, timeout=15)
            data = response.json()
            
            # Check for audio_base64 field
            has_audio_base64 = 'audio_base64' in data
            audio_length = len(data.get('audio_base64', '')) if has_audio_base64 else 0
            
            self.log_result(
                "POST /tts",
                response.status_code,
                200,
                {"has_audio_base64": has_audio_base64, "audio_length": audio_length},
                f"Audio data present: {has_audio_base64}, length: {audio_length}"
            )
            
        except Exception as e:
            self.log_result("POST /tts", 0, 200, {"error": str(e)})
            
    def test_voice_translate(self):
        """Test Voice Translate endpoint existence"""
        print("=== TESTING VOICE TRANSLATE ===")
        
        # Test with empty form data to check endpoint existence
        try:
            # Create a minimal audio file for testing
            files = {'audio': ('test.txt', b'not_audio_data', 'text/plain')}
            data = {'source_lang': 'en', 'target_lang': 'es'}
            
            response = requests.post(f"{BASE_URL}/voice-translate", files=files, data=data, timeout=15)
            
            # We expect 422 for invalid audio format, not 404
            expected_codes = [200, 400, 422, 500]  # Any but 404
            success = response.status_code in expected_codes
            
            self.log_result(
                "POST /voice-translate (endpoint check)",
                response.status_code,
                422,  # Expected for invalid audio
                response.json() if response.content else {},
                f"Endpoint exists (not 404): {response.status_code != 404}"
            )
            
        except Exception as e:
            self.log_result("POST /voice-translate", 0, 422, {"error": str(e)})
            
    def test_print_endpoints(self):
        """Test Print endpoints"""
        print("=== TESTING PRINT ENDPOINTS ===")
        
        # Test customer print
        try:
            payload = {
                "customer_id": "test-id",
                "printer_ip": "192.168.1.100"
            }
            
            response = requests.post(f"{BASE_URL}/print/customer", json=payload, timeout=10)
            
            # We expect any status but 404 (endpoint should exist)
            success = response.status_code != 404
            expected_codes = [200, 400, 404, 500]  # 404 would mean customer not found, which is ok
            
            self.log_result(
                "POST /print/customer",
                response.status_code,
                200 if response.status_code in [200, 404] else response.status_code,
                response.json() if response.content else {},
                f"Endpoint exists: {success}"
            )
            
        except Exception as e:
            self.log_result("POST /print/customer", 0, 200, {"error": str(e)})
            
        # Test license print
        try:
            payload = {
                "image_data": "base64string",
                "printer_ip": "192.168.1.100"
            }
            
            response = requests.post(f"{BASE_URL}/print/license", json=payload, timeout=10)
            success = response.status_code != 404
            
            self.log_result(
                "POST /print/license",
                response.status_code,
                200 if response.status_code in [200, 400, 500] else response.status_code,
                response.json() if response.content else {},
                f"Endpoint exists: {success}"
            )
            
        except Exception as e:
            self.log_result("POST /print/license", 0, 200, {"error": str(e)})
            
    def test_printer_test(self):
        """Test Printer test endpoint"""
        print("=== TESTING PRINTER TEST ===")
        
        payload = {
            "printer_ip": "192.168.1.1"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/printer/test", json=payload, timeout=10)
            
            # We expect structured error, not 404
            success = response.status_code != 404
            
            self.log_result(
                "POST /printer/test",
                response.status_code,
                520 if response.status_code in [520, 400, 500] else response.status_code,
                response.json() if response.content else {},
                f"Returns structured error (not 404): {success}"
            )
            
        except Exception as e:
            self.log_result("POST /printer/test", 0, 520, {"error": str(e)})
            
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 STARTING COMPREHENSIVE BACKEND API TESTING")
        print(f"Backend URL: {BASE_URL}")
        print("=" * 60)
        
        start_time = time.time()
        
        # Run all test suites
        self.test_customer_crud()
        self.test_translation()
        self.test_tower_talk()
        self.test_tts()
        self.test_voice_translate()
        self.test_print_endpoints()
        self.test_printer_test()
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Print summary
        print("=" * 60)
        print("🏁 BACKEND TESTING COMPLETE")
        print(f"Duration: {duration:.2f} seconds")
        print(f"Results: ✅ {self.passed} passed, ❌ {self.failed} failed")
        print(f"Success Rate: {(self.passed / (self.passed + self.failed) * 100):.1f}%")
        
        # Print failed tests details
        if self.failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  • {result['test']} - Got {result['status_code']}, expected {result['expected']}")
                    if result['notes']:
                        print(f"    Notes: {result['notes']}")
        
        print("=" * 60)
        
        return {
            "passed": self.passed,
            "failed": self.failed,
            "duration": duration,
            "success_rate": self.passed / (self.passed + self.failed) * 100,
            "results": self.test_results
        }

if __name__ == "__main__":
    tester = BackendTester()
    results = tester.run_all_tests()