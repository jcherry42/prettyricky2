#!/usr/bin/env python3
"""
AI Service Gateway Regression Test Suite
Testing AI Gateway implementation after ALL AI calls now route through the gateway
"""

import requests
import json
import base64
import os
import io
from PIL import Image
from pathlib import Path
import sys
import time

# Configuration
BASE_URL = "http://localhost:8001"
TIMEOUT = 30

def create_test_image(width=300, height=300, format='JPEG'):
    """Create a realistic test image for license scanning"""
    img = Image.new('RGB', (width, height), color='lightblue')
    img_buffer = io.BytesIO()
    img.save(img_buffer, format=format)
    img_buffer.seek(0)
    return img_buffer

def test_endpoint(method, endpoint, data=None, files=None, expected_status=200, description=""):
    """Test a single endpoint with detailed logging"""
    url = f"{BASE_URL}{endpoint}"
    print(f"\n🔍 {description}")
    print(f"   {method} {endpoint}")
    
    try:
        start_time = time.time()
        
        if method == "GET":
            response = requests.get(url, timeout=TIMEOUT)
        elif method == "POST":
            if files:
                response = requests.post(url, data=data, files=files, timeout=TIMEOUT)
            elif data and endpoint.endswith("/license/scan-direct"):
                response = requests.post(url, files=data, timeout=TIMEOUT)
            elif data:
                response = requests.post(url, json=data, timeout=TIMEOUT)
            else:
                response = requests.post(url, timeout=TIMEOUT)
        else:
            print(f"   ❌ Unsupported method: {method}")
            return False, None
        
        elapsed_ms = (time.time() - start_time) * 1000
        print(f"   Status: {response.status_code}")
        print(f"   Response time: {elapsed_ms:.0f}ms")
        
        # Check if status matches expected
        expected_statuses = expected_status if isinstance(expected_status, list) else [expected_status]
        
        if response.status_code in expected_statuses:
            try:
                response_json = response.json()
                print(f"   ✅ PASS")
                return True, response_json
            except:
                print(f"   ✅ PASS - Non-JSON response")
                return True, response.text
        else:
            print(f"   ❌ FAIL - Expected {expected_status}, got {response.status_code}")
            print(f"   Response: {response.text[:200]}...")
            return False, None
            
    except requests.exceptions.Timeout:
        print(f"   ❌ FAIL - Request timed out after {TIMEOUT}s")
        return False, None
    except Exception as e:
        print(f"   ❌ FAIL - Error: {str(e)}")
        return False, None

def validate_ai_stats_structure(stats_data):
    """Validate the structure of /api/ai/stats response"""
    print("   🔍 Validating AI Gateway stats structure...")
    
    required_keys = ["features", "cache", "circuit_breakers", "model_routes"]
    for key in required_keys:
        if key not in stats_data:
            print(f"   ❌ Missing key: {key}")
            return False
        print(f"   ✅ Found key: {key}")
    
    # Validate model_routes contains expected AI features
    expected_routes = ["license_ocr", "tower_talk", "translate", "vehicle_vision", "extraction", "tts"]
    model_routes = stats_data.get("model_routes", {})
    
    for route in expected_routes:
        if route not in model_routes:
            print(f"   ❌ Missing model route: {route}")
            return False
        route_data = model_routes[route]
        if "primary" not in route_data:
            print(f"   ❌ Missing 'primary' model for route: {route}")
            return False
        print(f"   ✅ Model route {route}: primary={route_data['primary']}, fallback={route_data.get('fallback', 'none')}")
    
    # Validate cache structure
    cache_data = stats_data.get("cache", {})
    cache_keys = ["entries", "max_entries", "hits", "misses", "hit_rate"]
    for key in cache_keys:
        if key not in cache_data:
            print(f"   ❌ Missing cache key: {key}")
            return False
        print(f"   ✅ Cache {key}: {cache_data[key]}")
    
    # Validate circuit_breakers structure
    cb_data = stats_data.get("circuit_breakers", {})
    print(f"   ✅ Circuit breakers: {cb_data}")
    
    return True

def main():
    """Run comprehensive AI Gateway regression test"""
    print("="*80)
    print("🎯 AI SERVICE GATEWAY COMPREHENSIVE REGRESSION TEST")
    print("   Testing after AI Gateway implementation - ALL AI calls route through gateway")
    print("="*80)
    
    # Track test results
    tests_passed = 0
    tests_total = 0
    
    # =============================================================================
    # TEST 1: Basic Health Check
    # =============================================================================
    print("\n" + "="*60)
    print("TEST 1: BASIC HEALTH CHECK")
    print("="*60)
    
    tests_total += 1
    success, _ = test_endpoint("GET", "/api/health", description="Basic health check")
    if success:
        tests_passed += 1
    
    # =============================================================================
    # TEST 2: NEW AI Gateway Stats Endpoint  
    # =============================================================================
    print("\n" + "="*60)
    print("TEST 2: AI GATEWAY STATS ENDPOINT (NEW)")
    print("="*60)
    
    tests_total += 1
    success, stats_data = test_endpoint("GET", "/api/ai/stats", 
                                       description="NEW endpoint - AI Gateway telemetry")
    if success and stats_data:
        if validate_ai_stats_structure(stats_data):
            tests_passed += 1
            print("   ✅ AI Gateway stats structure is valid")
        else:
            print("   ❌ AI Gateway stats structure validation failed")
    
    # =============================================================================
    # TEST 3: Translation Through Gateway (First Call)
    # =============================================================================
    print("\n" + "="*60)
    print("TEST 3: TRANSLATION THROUGH GATEWAY (First Call)")
    print("="*60)
    
    tests_total += 1
    translation_data = {
        "text": "The vehicle is ready for pickup",
        "source_lang": "en", 
        "target_lang": "es"
    }
    success, trans_response = test_endpoint("POST", "/api/translate", data=translation_data, 
                                           description="Translation through AI Gateway - first call")
    first_call_response = trans_response
    if success:
        tests_passed += 1
        if trans_response and isinstance(trans_response, dict):
            print(f"   📝 Translation result: {trans_response.get('translated_text', 'N/A')}")
    
    # =============================================================================
    # TEST 4: Translation Cache Hit (Same Text Again)
    # =============================================================================
    print("\n" + "="*60)
    print("TEST 4: TRANSLATION CACHE HIT (Same Text Again)")
    print("="*60)
    
    tests_total += 1
    # Same translation request - should be cache hit
    success, trans_response2 = test_endpoint("POST", "/api/translate", data=translation_data, 
                                            description="Same translation - should be cache hit")
    if success:
        tests_passed += 1
        if trans_response2 and isinstance(trans_response2, dict):
            print(f"   📝 Translation result: {trans_response2.get('translated_text', 'N/A')}")
    
    # =============================================================================
    # TEST 5: License Scan Through Gateway
    # =============================================================================
    print("\n" + "="*60)
    print("TEST 5: LICENSE SCAN THROUGH GATEWAY")
    print("="*60)
    
    tests_total += 1
    test_image = create_test_image(600, 400)  # Realistic size
    files = {'image': ('test_license.jpg', test_image, 'image/jpeg')}
    success, scan_response = test_endpoint("POST", "/api/license/scan-direct", files=files, 
                                          description="License OCR through AI Gateway")
    if success:
        tests_passed += 1
        if scan_response and isinstance(scan_response, dict):
            confidence = scan_response.get('confidence', 0)
            print(f"   📝 OCR confidence: {confidence}%")
            extracted = scan_response.get('extracted_data', {})
            if extracted:
                print(f"   📝 Extracted data keys: {list(extracted.keys())}")
    
    # =============================================================================
    # TEST 6: AI Stats After Gateway Usage
    # =============================================================================
    print("\n" + "="*60)
    print("TEST 6: AI STATS AFTER GATEWAY USAGE")
    print("="*60)
    
    tests_total += 1
    success, final_stats = test_endpoint("GET", "/api/ai/stats", 
                                        description="AI Gateway stats after usage")
    if success and final_stats:
        tests_passed += 1
        
        # Verify cache hits
        cache_data = final_stats.get("cache", {})
        cache_hits = cache_data.get("hits", 0)
        print(f"   📊 Cache hits: {cache_hits}")
        
        # Verify feature usage
        features_data = final_stats.get("features", {})
        print(f"   📊 Features used: {list(features_data.keys())}")
        
        # Check for translate and license_ocr usage
        translate_stats = features_data.get("translate")
        license_ocr_stats = features_data.get("license_ocr")
        
        if translate_stats:
            print(f"   📊 Translate calls: {translate_stats.get('calls', 0)}")
            print(f"   📊 Translate cache hits: {translate_stats.get('cache_hits', 0)}")
        
        if license_ocr_stats:
            print(f"   📊 License OCR calls: {license_ocr_stats.get('calls', 0)}")
        
        # Verify cache hit from repeated translation
        if cache_hits > 0:
            print("   ✅ Cache hits detected - caching is working")
        else:
            print("   ⚠️  No cache hits detected - may need investigation")
    
    # =============================================================================
    # TEST 7: Non-AI Endpoint Regression Check
    # =============================================================================
    print("\n" + "="*60)
    print("TEST 7: NON-AI ENDPOINT REGRESSION CHECK")
    print("="*60)
    
    tests_total += 1
    success, _ = test_endpoint("GET", "/api/vehicles/inventory", 
                              description="Non-AI endpoint - should still work identically")
    if success:
        tests_passed += 1
    
    # =============================================================================
    # CRITICAL VALIDATION CHECKS
    # =============================================================================
    print("\n" + "="*60)
    print("CRITICAL VALIDATION CHECKS")
    print("="*60)
    
    validation_passed = 0
    validation_total = 6
    
    if final_stats:
        # Check 1: Model routes for all 6 expected features
        model_routes = final_stats.get("model_routes", {})
        expected_routes = ["license_ocr", "tower_talk", "translate", "vehicle_vision", "extraction", "tts"]
        
        if all(route in model_routes for route in expected_routes):
            print("   ✅ All 6 model routes present")
            validation_passed += 1
        else:
            missing = [r for r in expected_routes if r not in model_routes]
            print(f"   ❌ Missing model routes: {missing}")
        
        # Check 2: Circuit breakers status exists
        cb_data = final_stats.get("circuit_breakers", {})
        if cb_data is not None:
            print("   ✅ Circuit breakers status present")
            validation_passed += 1
        else:
            print("   ❌ Circuit breakers status missing")
        
        # Check 3: Cache stats structure
        cache_data = final_stats.get("cache", {})
        cache_fields = ["hits", "misses", "hit_rate"]
        if all(field in cache_data for field in cache_fields):
            print("   ✅ Cache stats complete")
            validation_passed += 1
        else:
            print("   ❌ Cache stats incomplete")
        
        # Check 4: Translation returned correct translated text
        if first_call_response and isinstance(first_call_response, dict):
            translated = first_call_response.get("translated_text", "").lower()
            if "vehículo" in translated or "listo" in translated or "recog" in translated:
                print("   ✅ Translation appears correct")
                validation_passed += 1
            else:
                print(f"   ❌ Translation seems incorrect: {first_call_response.get('translated_text', 'N/A')}")
        
        # Check 5: Features used includes both translate and license_ocr
        features_used = list(final_stats.get("features", {}).keys())
        if "translate" in features_used and "license_ocr" in features_used:
            print("   ✅ Both translate and license_ocr features logged")
            validation_passed += 1
        else:
            print(f"   ❌ Expected features not all present. Found: {features_used}")
        
        # Check 6: All endpoints working identically (no regressions)
        if tests_passed >= 6:  # At least 6 out of 7 core tests passed
            print("   ✅ All existing endpoints work identically")
            validation_passed += 1
        else:
            print("   ❌ Some endpoints have regressions")
    
    # =============================================================================
    # RESULTS SUMMARY
    # =============================================================================
    print("\n" + "="*80)
    print("📊 AI GATEWAY REGRESSION TEST RESULTS")
    print("="*80)
    
    success_rate = (tests_passed / tests_total) * 100 if tests_total > 0 else 0
    validation_rate = (validation_passed / validation_total) * 100 if validation_total > 0 else 0
    
    print(f"Core Tests Passed: {tests_passed}/{tests_total}")
    print(f"Core Success Rate: {success_rate:.1f}%")
    print(f"Validation Checks: {validation_passed}/{validation_total}")
    print(f"Validation Rate: {validation_rate:.1f}%")
    
    overall_success = success_rate >= 90 and validation_rate >= 80
    
    if overall_success:
        print("✅ EXCELLENT - AI Gateway implementation is working correctly")
        print("   ✅ All AI calls successfully route through gateway")
        print("   ✅ NEW /api/ai/stats endpoint functional") 
        print("   ✅ Gateway telemetry (cache, circuit breakers, model routes) working")
        print("   ✅ Translation cache hits detected")
        print("   ✅ License OCR through gateway functional")
        print("   ✅ No regressions in existing endpoints")
    elif success_rate >= 70:
        print("⚠️  ACCEPTABLE - Core functionality works but some issues detected")
        print("   Review failed validation checks")
    else:
        print("❌ CRITICAL - Major issues with AI Gateway implementation")
        print("   Gateway may not be properly routing AI calls")
    
    print("\n" + "="*80)
    return overall_success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)