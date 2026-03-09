#!/usr/bin/env python3
"""
Supercharg'd Backend Comprehensive Regression Test Suite
Testing all critical automotive sales mobile app endpoints
Target: >90% pass rate for production readiness

Covers all endpoints specified in the review request:
1. Health: GET /api/health
2. Translation: POST /api/translate (3 tests)
3. TTS: POST /api/tts  
4. Tower Talk: POST /api/tower-talk
5. Customer CRUD: POST /api/customers/create (must return 201), GET /api/customers/list, GET /api/customers/{id}, DELETE /api/customers/{id}
6. VIN: GET /api/vin/decode/{vin}
7. VIN Trade-in: GET /api/vin/trade-in-count
8. Dashboard: GET /api/dashboard/stats
9. Voice Translate: POST /api/voice-translate (validation test)
10. License Parse: POST /api/license/parse-pdf417
"""

import asyncio
import aiohttp
import json
import time
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional

# Backend URL from mobile environment
BACKEND_URL = "https://scanner-debug-test.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class TestResults:
    def __init__(self):
        self.total_tests = 0
        self.passed_tests = 0
        self.failed_tests = 0
        self.results = []
        
    def add_result(self, test_name: str, passed: bool, details: str = "", response_time: float = 0):
        self.total_tests += 1
        if passed:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
        
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details,
            "response_time_ms": round(response_time * 1000, 2)
        })
    
    def get_pass_rate(self) -> float:
        if self.total_tests == 0:
            return 0.0
        return (self.passed_tests / self.total_tests) * 100

async def make_request(session: aiohttp.ClientSession, method: str, url: str, 
                      json_data: Dict = None, form_data: aiohttp.FormData = None,
                      timeout: int = 30) -> Dict[str, Any]:
    """Make HTTP request and return response details"""
    start_time = time.time()
    
    try:
        timeout_config = aiohttp.ClientTimeout(total=timeout)
        
        if method.upper() == "GET":
            async with session.get(url, timeout=timeout_config) as response:
                response_time = time.time() - start_time
                text = await response.text()
                
                try:
                    data = json.loads(text) if text else {}
                except json.JSONDecodeError:
                    data = {"raw_response": text}
                
                return {
                    "status": response.status,
                    "data": data,
                    "response_time": response_time,
                    "headers": dict(response.headers)
                }
        
        elif method.upper() == "POST":
            kwargs = {"timeout": timeout_config}
            if json_data is not None:
                kwargs["json"] = json_data
                kwargs["headers"] = {"Content-Type": "application/json"}
            elif form_data is not None:
                kwargs["data"] = form_data
            
            async with session.post(url, **kwargs) as response:
                response_time = time.time() - start_time
                text = await response.text()
                
                try:
                    data = json.loads(text) if text else {}
                except json.JSONDecodeError:
                    data = {"raw_response": text}
                
                return {
                    "status": response.status,
                    "data": data,
                    "response_time": response_time,
                    "headers": dict(response.headers)
                }
        
        elif method.upper() == "DELETE":
            async with session.delete(url, timeout=timeout_config) as response:
                response_time = time.time() - start_time
                text = await response.text()
                
                try:
                    data = json.loads(text) if text else {}
                except json.JSONDecodeError:
                    data = {"raw_response": text}
                
                return {
                    "status": response.status,
                    "data": data,
                    "response_time": response_time,
                    "headers": dict(response.headers)
                }
                
    except asyncio.TimeoutError:
        response_time = time.time() - start_time
        return {
            "status": 408,
            "data": {"error": "Request timeout"},
            "response_time": response_time,
            "headers": {}
        }
    except Exception as e:
        response_time = time.time() - start_time
        return {
            "status": 500,
            "data": {"error": str(e)},
            "response_time": response_time,
            "headers": {}
        }

async def test_health_endpoint(session: aiohttp.ClientSession, results: TestResults):
    """Test 1: Health check endpoint - GET /api/health → expect {"status":"healthy"}"""
    print("🔍 Testing health endpoint...")
    
    response = await make_request(session, "GET", f"{API_BASE}/health")
    
    if response["status"] == 200 and response["data"].get("status") == "healthy":
        results.add_result("Health Check", True, 
                          f"Status: {response['status']}, Response: healthy", 
                          response["response_time"])
        print(f"✅ Health check passed ({response['response_time']*1000:.0f}ms)")
    else:
        results.add_result("Health Check", False, 
                          f"Status: {response['status']}, Data: {response['data']}", 
                          response["response_time"])
        print(f"❌ Health check failed - Status: {response['status']}")

async def test_translation_endpoints(session: aiohttp.ClientSession, results: TestResults):
    """Test 2-4: Translation endpoints (3 tests) as specified in review"""
    print("🔍 Testing translation endpoints...")
    
    translation_tests = [
        {"text": "Hello", "source_lang": "en", "target_lang": "es", "name": "Translation EN→ES"},
        {"text": "Test drive?", "source_lang": "en", "target_lang": "fr", "name": "Translation EN→FR"},
        {"text": "Financing", "source_lang": "en", "target_lang": "ko", "name": "Translation EN→KO"}
    ]
    
    for test_case in translation_tests:
        response = await make_request(session, "POST", f"{API_BASE}/translate", 
                                    json_data={
                                        "text": test_case["text"],
                                        "source_lang": test_case["source_lang"],
                                        "target_lang": test_case["target_lang"]
                                    })
        
        if (response["status"] == 200 and 
            "translated_text" in response["data"] and 
            response["data"]["translated_text"]):
            results.add_result(test_case["name"], True,
                              f"'{test_case['text']}' → '{response['data']['translated_text']}'",
                              response["response_time"])
            print(f"✅ {test_case['name']} passed ({response['response_time']*1000:.0f}ms)")
        else:
            results.add_result(test_case["name"], False,
                              f"Status: {response['status']}, Data: {response['data']}",
                              response["response_time"])
            print(f"❌ {test_case['name']} failed - Status: {response['status']}")

async def test_tts_endpoint(session: aiohttp.ClientSession, results: TestResults):
    """Test 5: Text-to-Speech endpoint - POST /api/tts → expect audio_base64"""
    print("🔍 Testing TTS endpoint...")
    
    response = await make_request(session, "POST", f"{API_BASE}/tts",
                                json_data={
                                    "text": "Welcome",
                                    "language": "en",
                                    "voice": "auto"
                                })
    
    if (response["status"] == 200 and 
        "audio_base64" in response["data"] and 
        response["data"]["audio_base64"]):
        results.add_result("TTS Generation", True,
                          f"Generated audio ({len(response['data']['audio_base64'])} chars)",
                          response["response_time"])
        print(f"✅ TTS generation passed ({response['response_time']*1000:.0f}ms)")
    else:
        results.add_result("TTS Generation", False,
                          f"Status: {response['status']}, Data: {response['data']}",
                          response["response_time"])
        print(f"❌ TTS generation failed - Status: {response['status']}")

async def test_tower_talk_endpoint(session: aiohttp.ClientSession, results: TestResults):
    """Test 6: Tower Talk AI endpoint - POST /api/tower-talk → expect response field"""
    print("🔍 Testing Tower Talk endpoint...")
    
    response = await make_request(session, "POST", f"{API_BASE}/tower-talk",
                                json_data={
                                    "situation": "Price question",
                                    "inquiryType": "price_question",
                                    "context": {
                                        "customerName": "Alex",
                                        "vehicle": "GLE 450",
                                        "dealershipName": "MB"
                                    }
                                })
    
    if (response["status"] == 200 and 
        "response" in response["data"] and 
        response["data"]["response"]):
        results.add_result("Tower Talk AI", True,
                          f"Generated response ({len(response['data']['response'])} chars)",
                          response["response_time"])
        print(f"✅ Tower Talk AI passed ({response['response_time']*1000:.0f}ms)")
    else:
        results.add_result("Tower Talk AI", False,
                          f"Status: {response['status']}, Data: {response['data']}",
                          response["response_time"])
        print(f"❌ Tower Talk AI failed - Status: {response['status']}")

async def test_customer_crud_endpoints(session: aiohttp.ClientSession, results: TestResults):
    """Test 7-10: Customer CRUD operations (4 tests) - CRITICAL: create must return 201"""
    print("🔍 Testing customer CRUD operations...")
    
    # Test 7: Create customer (MUST return 201 - as specified in review)
    create_response = await make_request(session, "POST", f"{API_BASE}/customers/create",
                                       json_data={
                                           "first_name": "Regression",
                                           "last_name": "Test", 
                                           "phone": "555-9999"
                                       })
    
    created_customer_id = None
    if create_response["status"] == 201:
        # Customer ID is nested in the "customer" object
        customer_data = create_response["data"].get("customer", {})
        created_customer_id = customer_data.get("id")
        results.add_result("Customer Create (201)", True,
                          f"Created customer with ID: {created_customer_id}",
                          create_response["response_time"])
        print(f"✅ Customer creation passed (201) ({create_response['response_time']*1000:.0f}ms)")
    else:
        results.add_result("Customer Create (201)", False,
                          f"CRITICAL: Expected 201, got {create_response['status']}: {create_response['data']}",
                          create_response["response_time"])
        print(f"❌ Customer creation FAILED - Expected 201, got {create_response['status']}")
    
    # Test 8: List customers - GET /api/customers/list?limit=5 → expect customers array and total
    list_response = await make_request(session, "GET", f"{API_BASE}/customers/list?limit=5")
    
    if (list_response["status"] == 200 and 
        "customers" in list_response["data"] and 
        "total" in list_response["data"]):
        results.add_result("Customer List", True,
                          f"Found {list_response['data']['total']} customers",
                          list_response["response_time"])
        print(f"✅ Customer list passed ({list_response['response_time']*1000:.0f}ms)")
    else:
        results.add_result("Customer List", False,
                          f"Status: {list_response['status']}, Data: {list_response['data']}",
                          list_response["response_time"])
        print(f"❌ Customer list failed - Status: {list_response['status']}")
    
    # Test 9: Get customer by ID (if we created one)
    if created_customer_id:
        get_response = await make_request(session, "GET", f"{API_BASE}/customers/{created_customer_id}")
        
        if get_response["status"] == 200 and get_response["data"].get("id") == created_customer_id:
            results.add_result("Customer Get by ID", True,
                              f"Retrieved customer: {get_response['data'].get('first_name', '')} {get_response['data'].get('last_name', '')}",
                              get_response["response_time"])
            print(f"✅ Customer get by ID passed ({get_response['response_time']*1000:.0f}ms)")
        else:
            results.add_result("Customer Get by ID", False,
                              f"Status: {get_response['status']}, Data: {get_response['data']}",
                              get_response["response_time"])
            print(f"❌ Customer get by ID failed - Status: {get_response['status']}")
        
        # Test 10: Delete customer - DELETE /api/customers/{id} → expect 200
        delete_response = await make_request(session, "DELETE", f"{API_BASE}/customers/{created_customer_id}")
        
        if delete_response["status"] == 200:
            results.add_result("Customer Delete", True,
                              f"Deleted customer {created_customer_id}",
                              delete_response["response_time"])
            print(f"✅ Customer deletion passed ({delete_response['response_time']*1000:.0f}ms)")
        else:
            results.add_result("Customer Delete", False,
                              f"Status: {delete_response['status']}, Data: {delete_response['data']}",
                              delete_response["response_time"])
            print(f"❌ Customer deletion failed - Status: {delete_response['status']}")
    else:
        results.add_result("Customer Get by ID", False, "No customer ID to test with", 0)
        results.add_result("Customer Delete", False, "No customer ID to test with", 0)
        print("❌ Customer get/delete skipped - no customer ID available")

async def test_vin_endpoints(session: aiohttp.ClientSession, results: TestResults):
    """Test 11-12: VIN-related endpoints"""
    print("🔍 Testing VIN endpoints...")
    
    # Test 11: VIN decode - GET /api/vin/decode/JM3KKEHA3T1355103 → expect 200
    vin_response = await make_request(session, "GET", f"{API_BASE}/vin/decode/JM3KKEHA3T1355103")
    
    if vin_response["status"] == 200:
        results.add_result("VIN Decode", True,
                          f"Decoded VIN successfully",
                          vin_response["response_time"])
        print(f"✅ VIN decode passed ({vin_response['response_time']*1000:.0f}ms)")
    else:
        results.add_result("VIN Decode", False,
                          f"Status: {vin_response['status']}, Data: {vin_response['data']}",
                          vin_response["response_time"])
        print(f"❌ VIN decode failed - Status: {vin_response['status']}")
    
    # Test 12: VIN trade-in count - GET /api/vin/trade-in-count → expect count field
    trade_in_response = await make_request(session, "GET", f"{API_BASE}/vin/trade-in-count")
    
    if (trade_in_response["status"] == 200 and 
        "count" in trade_in_response["data"]):
        results.add_result("VIN Trade-in Count", True,
                          f"Trade-in count: {trade_in_response['data']['count']}",
                          trade_in_response["response_time"])
        print(f"✅ VIN trade-in count passed ({trade_in_response['response_time']*1000:.0f}ms)")
    else:
        results.add_result("VIN Trade-in Count", False,
                          f"Status: {trade_in_response['status']}, Data: {trade_in_response['data']}",
                          trade_in_response["response_time"])
        print(f"❌ VIN trade-in count failed - Status: {trade_in_response['status']}")

async def test_dashboard_endpoint(session: aiohttp.ClientSession, results: TestResults):
    """Test 13: Dashboard stats endpoint - GET /api/dashboard/stats → expect 200"""
    print("🔍 Testing dashboard endpoint...")
    
    response = await make_request(session, "GET", f"{API_BASE}/dashboard/stats")
    
    if response["status"] == 200:
        results.add_result("Dashboard Stats", True,
                          "Dashboard stats retrieved successfully",
                          response["response_time"])
        print(f"✅ Dashboard stats passed ({response['response_time']*1000:.0f}ms)")
    else:
        results.add_result("Dashboard Stats", False,
                          f"Status: {response['status']}, Data: {response['data']}",
                          response["response_time"])
        print(f"❌ Dashboard stats failed - Status: {response['status']}")

async def test_voice_translate_validation(session: aiohttp.ClientSession, results: TestResults):
    """Test 14: Voice translate validation - POST /api/voice-translate with invalid data → should return 422"""
    print("🔍 Testing voice translate validation...")
    
    # Create form data with empty audio file (should trigger 422)
    form_data = aiohttp.FormData()
    form_data.add_field('audio', b'', filename='empty.wav', content_type='audio/wav')
    form_data.add_field('source_lang', 'en')
    form_data.add_field('target_lang', 'es')
    
    response = await make_request(session, "POST", f"{API_BASE}/voice-translate", form_data=form_data)
    
    if response["status"] == 422:
        results.add_result("Voice Translate Validation", True,
                          "Correctly returned 422 for invalid data",
                          response["response_time"])
        print(f"✅ Voice translate validation passed (422) ({response['response_time']*1000:.0f}ms)")
    else:
        results.add_result("Voice Translate Validation", False,
                          f"Expected 422, got {response['status']}: {response['data']}",
                          response["response_time"])
        print(f"❌ Voice translate validation failed - Expected 422, got {response['status']}")

async def test_license_parse_endpoint(session: aiohttp.ClientSession, results: TestResults):
    """Test 15: License parse PDF417 endpoint - POST /api/license/parse-pdf417 → should work or return proper error"""
    print("🔍 Testing license parse PDF417 endpoint...")
    
    response = await make_request(session, "POST", f"{API_BASE}/license/parse-pdf417",
                                json_data={"barcode_data": "test"})
    
    # This should work or return a proper error - any response is acceptable for this test
    if response["status"] in [200, 400, 422]:  # Valid responses
        results.add_result("License Parse PDF417", True,
                          f"Endpoint responsive (status: {response['status']})",
                          response["response_time"])
        print(f"✅ License parse PDF417 passed ({response['response_time']*1000:.0f}ms)")
    else:
        results.add_result("License Parse PDF417", False,
                          f"Status: {response['status']}, Data: {response['data']}",
                          response["response_time"])
        print(f"❌ License parse PDF417 failed - Status: {response['status']}")

async def run_comprehensive_test():
    """Run all comprehensive backend tests as specified in review request"""
    print("🚀 Starting Supercharg'd Backend Comprehensive Regression Test")
    print(f"🎯 Backend URL: {BACKEND_URL}")
    print(f"🎯 Target: >90% pass rate for production readiness")
    print("📋 Testing ALL endpoints from review request:")
    print("   1. Health, 2-4. Translation (3 tests), 5. TTS, 6. Tower Talk")
    print("   7-10. Customer CRUD (4 tests), 11-12. VIN (2 tests)")
    print("   13. Dashboard, 14. Voice Translate, 15. License Parse")
    print("=" * 80)
    
    results = TestResults()
    
    # Configure session with proper timeout and headers
    timeout = aiohttp.ClientTimeout(total=60)  # 60 second timeout
    headers = {
        'User-Agent': 'Supercharged-Backend-Test/1.0',
        'Accept': 'application/json'
    }
    
    async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
        # Run all test suites in the order specified in review
        await test_health_endpoint(session, results)  # 1
        await test_translation_endpoints(session, results)  # 2-4 (3 tests)
        await test_tts_endpoint(session, results)  # 5
        await test_tower_talk_endpoint(session, results)  # 6
        await test_customer_crud_endpoints(session, results)  # 7-10 (4 tests)
        await test_vin_endpoints(session, results)  # 11-12 (2 tests)
        await test_dashboard_endpoint(session, results)  # 13
        await test_voice_translate_validation(session, results)  # 14
        await test_license_parse_endpoint(session, results)  # 15
    
    # Generate comprehensive report
    print("\n" + "=" * 80)
    print("📊 COMPREHENSIVE TEST RESULTS")
    print("=" * 80)
    
    pass_rate = results.get_pass_rate()
    print(f"🎯 PASS RATE: {pass_rate:.1f}% ({results.passed_tests}/{results.total_tests} tests)")
    
    if pass_rate >= 90.0:
        print("🎉 QUALITY GATE: PASSED (≥90%) - PRODUCTION READY")
    else:
        print("❌ QUALITY GATE: FAILED (<90%) - NEEDS ATTENTION")
    
    print(f"✅ Passed: {results.passed_tests}")
    print(f"❌ Failed: {results.failed_tests}")
    
    # Detailed results
    print("\n📋 DETAILED TEST RESULTS:")
    print("-" * 80)
    
    for result in results.results:
        status = "✅ PASS" if result["passed"] else "❌ FAIL"
        print(f"{status} | {result['test']:<30} | {result['response_time_ms']:>6}ms | {result['details']}")
    
    # Failed tests summary
    failed_tests = [r for r in results.results if not r["passed"]]
    if failed_tests:
        print(f"\n🚨 FAILED TESTS SUMMARY ({len(failed_tests)} failures):")
        print("-" * 80)
        for test in failed_tests:
            print(f"❌ {test['test']}: {test['details']}")
    
    # Performance summary
    avg_response_time = sum(r["response_time_ms"] for r in results.results) / len(results.results)
    print(f"\n⚡ PERFORMANCE SUMMARY:")
    print(f"Average Response Time: {avg_response_time:.1f}ms")
    
    slowest_test = max(results.results, key=lambda x: x["response_time_ms"])
    print(f"Slowest Test: {slowest_test['test']} ({slowest_test['response_time_ms']:.1f}ms)")
    
    # Save results to file
    test_summary = {
        "timestamp": datetime.now().isoformat(),
        "pass_rate": pass_rate,
        "total_tests": results.total_tests,
        "passed": results.passed_tests,
        "failed": results.failed_tests,
        "avg_response_time_ms": avg_response_time,
        "quality_gate": "PASS" if pass_rate >= 90.0 else "FAIL",
        "test_results": results.results
    }
    
    with open('/app/comprehensive_test_results.json', 'w') as f:
        json.dump(test_summary, f, indent=2)
    
    print(f"\n📁 Detailed results saved to: /app/comprehensive_test_results.json")
    print("=" * 80)
    return pass_rate >= 90.0

if __name__ == "__main__":
    try:
        success = asyncio.run(run_comprehensive_test())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n⏹️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test suite crashed: {e}")
        sys.exit(1)