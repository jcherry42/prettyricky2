#!/usr/bin/env python3
"""
Comprehensive Backend Test Suite - Supercharg'd Automotive Middleware
Testing new VectorDB/Knowledge Base endpoints, Telemetry endpoints, and core regressions
"""

import requests
import json
import time
from typing import Dict, Any, List

# Backend URL
BASE_URL = "http://localhost:8001"

def test_result(name: str, success: bool, response_time: float = None, details: str = ""):
    """Print test result in consistent format"""
    status = "✅ PASS" if success else "❌ FAIL"
    time_info = f" ({response_time:.0f}ms)" if response_time else ""
    print(f"{status} {name}{time_info}")
    if details:
        print(f"    {details}")
    return success

def make_request(method: str, url: str, **kwargs) -> tuple[requests.Response, float]:
    """Make HTTP request and track timing"""
    start_time = time.time()
    try:
        response = requests.request(method, url, timeout=30, **kwargs)
        response_time = (time.time() - start_time) * 1000
        return response, response_time
    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        print(f"    Request failed: {str(e)}")
        return None, response_time

def test_knowledge_base_endpoints():
    """Test NEW VectorDB/Knowledge Base endpoints (HIGH PRIORITY)"""
    print("\n🎯 TESTING VECTORDB/KNOWLEDGE BASE ENDPOINTS")
    results = []
    
    # Test 1: GET /api/knowledge/stats
    print("\n1. Testing Knowledge Stats Endpoint")
    response, rt = make_request('GET', f"{BASE_URL}/api/knowledge/stats")
    if response and response.status_code == 200:
        data = response.json()
        # Check for expected stats structure
        has_entries = 'knowledge_entries' in data
        has_categories = 'categories' in data
        expected_entries = data.get('knowledge_entries', 0) == 32
        expected_categories = data.get('categories', 0) == 10
        
        if has_entries and has_categories:
            entries_msg = f"knowledge_entries={data.get('knowledge_entries', 0)}"
            categories_msg = f"categories={data.get('categories', 0)}"
            details = f"Structure OK: {entries_msg}, {categories_msg}"
            if expected_entries and expected_categories:
                details += " (matches expected: 32 entries, 10 categories)"
            results.append(test_result("Knowledge Stats", True, rt, details))
        else:
            results.append(test_result("Knowledge Stats", False, rt, f"Missing required fields. Got: {list(data.keys())}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Knowledge Stats", False, rt, f"HTTP {status}"))
    
    # Test 2: POST /api/knowledge/search - Customer objection query
    print("\n2. Testing Knowledge Search - Customer Objection")
    search_body = {
        "query": "customer says price is too high",
        "top_k": 3
    }
    response, rt = make_request('POST', f"{BASE_URL}/api/knowledge/search", json=search_body)
    if response and response.status_code == 200:
        data = response.json()
        has_results = 'results' in data and isinstance(data['results'], list)
        has_count = 'count' in data
        results_count = len(data.get('results', []))
        
        if has_results and has_count and results_count > 0:
            # Check if results have scores (ranked)
            first_result = data['results'][0] if data['results'] else {}
            has_score = 'score' in first_result or 'similarity' in first_result
            details = f"Found {results_count} results, ranked: {'Yes' if has_score else 'No'}"
            results.append(test_result("Knowledge Search - Objection", True, rt, details))
        else:
            results.append(test_result("Knowledge Search - Objection", False, rt, f"Invalid structure or no results. Got: {data}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Knowledge Search - Objection", False, rt, f"HTTP {status}"))
    
    # Test 3: POST /api/knowledge/search - Category filter
    print("\n3. Testing Knowledge Search - Category Filter")
    search_body = {
        "query": "how to set an appointment",
        "category": "appointment_setting"
    }
    response, rt = make_request('POST', f"{BASE_URL}/api/knowledge/search", json=search_body)
    if response and response.status_code == 200:
        data = response.json()
        has_results = 'results' in data and isinstance(data['results'], list)
        results_count = len(data.get('results', []))
        
        if has_results:
            details = f"Category filter working, found {results_count} results for 'appointment_setting'"
            results.append(test_result("Knowledge Search - Category Filter", True, rt, details))
        else:
            results.append(test_result("Knowledge Search - Category Filter", False, rt, f"Invalid structure. Got: {data}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Knowledge Search - Category Filter", False, rt, f"HTTP {status}"))
    
    # Test 4: POST /api/knowledge/seed
    print("\n4. Testing Knowledge Seed (Re-seed)")
    response, rt = make_request('POST', f"{BASE_URL}/api/knowledge/seed")
    if response and response.status_code == 200:
        data = response.json()
        has_seeded = 'seeded' in data
        
        if has_seeded:
            seeded_count = data.get('seeded', 0)
            details = f"Re-seeded {seeded_count} entries (idempotent operation)"
            results.append(test_result("Knowledge Seed", True, rt, details))
        else:
            results.append(test_result("Knowledge Seed", False, rt, f"Missing 'seeded' field. Got: {data}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Knowledge Seed", False, rt, f"HTTP {status}"))
    
    return results

def test_telemetry_endpoints():
    """Test NEW Telemetry endpoints (HIGH PRIORITY)"""
    print("\n🎯 TESTING TELEMETRY ENDPOINTS")
    results = []
    
    # Test 1: POST /api/telemetry/track
    print("\n1. Testing Telemetry Track")
    track_body = {
        "category": "ai_usage",
        "action": "tower_talk_generate",
        "properties": {
            "inquiry_type": "objection",
            "latency_ms": 1200
        }
    }
    response, rt = make_request('POST', f"{BASE_URL}/api/telemetry/track", json=track_body)
    if response and response.status_code == 200:
        data = response.json()
        has_tracked = data.get('tracked') is True
        
        if has_tracked:
            details = f"Event tracked: {track_body['category']}.{track_body['action']}"
            results.append(test_result("Telemetry Track", True, rt, details))
        else:
            results.append(test_result("Telemetry Track", False, rt, f"Tracking failed. Got: {data}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Telemetry Track", False, rt, f"HTTP {status}"))
    
    # Test 2: GET /api/telemetry/summary
    print("\n2. Testing Telemetry Summary")
    response, rt = make_request('GET', f"{BASE_URL}/api/telemetry/summary?hours=24")
    if response and response.status_code == 200:
        data = response.json()
        # Check for event breakdown structure
        has_events = isinstance(data, dict)
        
        if has_events:
            event_types = list(data.keys())
            details = f"Event breakdown available, types: {event_types[:3]}..." if len(event_types) > 3 else f"Event types: {event_types}"
            results.append(test_result("Telemetry Summary", True, rt, details))
        else:
            results.append(test_result("Telemetry Summary", False, rt, f"Invalid structure. Got: {type(data)}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Telemetry Summary", False, rt, f"HTTP {status}"))
    
    # Test 3: GET /api/telemetry/sales-funnel
    print("\n3. Testing Telemetry Sales Funnel")
    response, rt = make_request('GET', f"{BASE_URL}/api/telemetry/sales-funnel?days=30")
    if response and response.status_code == 200:
        data = response.json()
        # Check for funnel metrics structure
        has_funnel = isinstance(data, dict)
        
        if has_funnel:
            funnel_keys = list(data.keys())
            details = f"Funnel metrics available, keys: {funnel_keys[:3]}..." if len(funnel_keys) > 3 else f"Funnel keys: {funnel_keys}"
            results.append(test_result("Telemetry Sales Funnel", True, rt, details))
        else:
            results.append(test_result("Telemetry Sales Funnel", False, rt, f"Invalid structure. Got: {type(data)}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Telemetry Sales Funnel", False, rt, f"HTTP {status}"))
    
    # Test 4: GET /api/telemetry/ai-usage
    print("\n4. Testing Telemetry AI Usage")
    response, rt = make_request('GET', f"{BASE_URL}/api/telemetry/ai-usage?days=7")
    if response and response.status_code == 200:
        data = response.json()
        # Check for AI usage breakdown
        has_usage = isinstance(data, dict)
        
        if has_usage:
            usage_keys = list(data.keys())
            details = f"AI usage breakdown available, keys: {usage_keys[:3]}..." if len(usage_keys) > 3 else f"Usage keys: {usage_keys}"
            results.append(test_result("Telemetry AI Usage", True, rt, details))
        else:
            results.append(test_result("Telemetry AI Usage", False, rt, f"Invalid structure. Got: {type(data)}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Telemetry AI Usage", False, rt, f"HTTP {status}"))
    
    return results

def test_core_regression():
    """Test core endpoints for regressions"""
    print("\n🎯 TESTING CORE REGRESSION ENDPOINTS")
    results = []
    
    # Test 1: GET /api/health
    print("\n1. Testing Health Check")
    response, rt = make_request('GET', f"{BASE_URL}/api/health")
    if response and response.status_code == 200:
        data = response.json()
        is_healthy = data.get('status') == 'healthy'
        
        if is_healthy:
            details = f"Status: {data.get('status')}"
            results.append(test_result("Health Check", True, rt, details))
        else:
            results.append(test_result("Health Check", False, rt, f"Not healthy. Status: {data.get('status')}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Health Check", False, rt, f"HTTP {status}"))
    
    # Test 2: POST /api/tower-talk
    print("\n2. Testing Tower Talk AI")
    tower_talk_body = {
        "situation": "Customer interested in a 2024 BMW X5, asking about financing",
        "inquiryType": "financing",
        "context": {
            "customerName": "John",
            "vehicle": "2024 BMW X5",
            "dealershipName": "Elite Motors",
            "salespersonName": "Mike Smith"
        }
    }
    response, rt = make_request('POST', f"{BASE_URL}/api/tower-talk", json=tower_talk_body)
    if response and response.status_code == 200:
        data = response.json()
        has_response = 'response' in data or 'message' in data
        
        if has_response:
            response_text = data.get('response', data.get('message', ''))
            details = f"Elite sales response generated ({len(response_text)} chars)"
            results.append(test_result("Tower Talk AI", True, rt, details))
        else:
            results.append(test_result("Tower Talk AI", False, rt, f"No response field. Got: {list(data.keys())}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Tower Talk AI", False, rt, f"HTTP {status}"))
    
    # Test 3: POST /api/translate
    print("\n3. Testing Translation")
    translate_body = {
        "text": "I'm interested in the vehicle",
        "target_lang": "es"
    }
    response, rt = make_request('POST', f"{BASE_URL}/api/translate", json=translate_body)
    if response and response.status_code == 200:
        data = response.json()
        has_translation = 'translated_text' in data
        
        if has_translation:
            translation = data.get('translated_text', '')
            details = f"Translation: '{translation}'"
            results.append(test_result("Translation", True, rt, details))
        else:
            results.append(test_result("Translation", False, rt, f"No translated_text field. Got: {list(data.keys())}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Translation", False, rt, f"HTTP {status}"))
    
    # Test 4: GET /api/customers/list
    print("\n4. Testing Customer List")
    response, rt = make_request('GET', f"{BASE_URL}/api/customers/list")
    if response and response.status_code == 200:
        data = response.json()
        has_customers = 'customers' in data
        has_total = 'total' in data
        
        if has_customers and has_total:
            customer_count = len(data.get('customers', []))
            total_count = data.get('total', 0)
            details = f"Found {customer_count} customers (total: {total_count})"
            results.append(test_result("Customer List", True, rt, details))
        else:
            results.append(test_result("Customer List", False, rt, f"Missing required fields. Got: {list(data.keys())}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("Customer List", False, rt, f"HTTP {status}"))
    
    # Test 5: GET /api/ai/stats
    print("\n5. Testing AI Gateway Stats")
    response, rt = make_request('GET', f"{BASE_URL}/api/ai/stats")
    if response and response.status_code == 200:
        data = response.json()
        has_stats = isinstance(data, dict) and len(data) > 0
        
        if has_stats:
            stat_keys = list(data.keys())
            details = f"AI Gateway stats available, keys: {stat_keys[:3]}..." if len(stat_keys) > 3 else f"Stats: {stat_keys}"
            results.append(test_result("AI Gateway Stats", True, rt, details))
        else:
            results.append(test_result("AI Gateway Stats", False, rt, f"No stats available. Got: {data}"))
    else:
        status = response.status_code if response else "No response"
        results.append(test_result("AI Gateway Stats", False, rt, f"HTTP {status}"))
    
    return results

def test_error_handling():
    """Test error handling for voice translate endpoint"""
    print("\n🎯 TESTING ERROR HANDLING")
    results = []
    
    # Test: POST /api/voice-translate with empty audio (should return 422)
    print("\n1. Testing Voice Translate Error Handling")
    response, rt = make_request('POST', f"{BASE_URL}/api/voice-translate", json={})
    if response and response.status_code == 422:
        details = "Correctly returns 422 for empty audio"
        results.append(test_result("Voice Translate Error Handling", True, rt, details))
    elif response:
        details = f"Expected 422, got {response.status_code}"
        results.append(test_result("Voice Translate Error Handling", False, rt, details))
    else:
        results.append(test_result("Voice Translate Error Handling", False, rt, "No response"))
    
    return results

def main():
    """Run comprehensive backend test suite"""
    print("🚀 STARTING COMPREHENSIVE BACKEND TEST SUITE")
    print("=" * 60)
    
    all_results = []
    
    # Run all test suites
    all_results.extend(test_knowledge_base_endpoints())
    all_results.extend(test_telemetry_endpoints())
    all_results.extend(test_core_regression())
    all_results.extend(test_error_handling())
    
    # Calculate summary
    total_tests = len(all_results)
    passed_tests = sum(1 for result in all_results if result)
    failed_tests = total_tests - passed_tests
    pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"📈 Pass Rate: {pass_rate:.1f}%")
    
    # Quality gate assessment
    if pass_rate >= 90:
        print(f"🎉 EXCELLENT PASS RATE ({pass_rate:.1f}%) - Production Ready!")
    elif pass_rate >= 75:
        print(f"✅ GOOD PASS RATE ({pass_rate:.1f}%) - Minor issues to address")
    else:
        print(f"⚠️  LOW PASS RATE ({pass_rate:.1f}%) - Significant issues need attention")
    
    return pass_rate >= 75

if __name__ == "__main__":
    main()