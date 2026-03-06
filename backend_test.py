#!/usr/bin/env python3
"""
Backend Regression Test Suite
Testing endpoints after major dead code cleanup (~550 lines removed)
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

def create_test_image(width=100, height=100, format='JPEG'):
    """Create a small test image for upload tests"""
    img = Image.new('RGB', (width, height), color='red')
    img_buffer = io.BytesIO()
    img.save(img_buffer, format=format)
    img_buffer.seek(0)
    return img_buffer

def test_endpoint(method, endpoint, data=None, files=None, expected_status=200, description=""):
    """Test a single endpoint"""
    url = f"{BASE_URL}{endpoint}"
    print(f"\n🔍 {description}")
    print(f"   {method} {endpoint}")
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=TIMEOUT)
        elif method == "POST":
            if files:
                response = requests.post(url, data=data, files=files, timeout=TIMEOUT)
            elif data and endpoint.endswith("/license/create-customer"):
                # This endpoint expects form data, not JSON
                response = requests.post(url, data=data, timeout=TIMEOUT)
            elif data:
                response = requests.post(url, json=data, timeout=TIMEOUT)
            else:
                response = requests.post(url, timeout=TIMEOUT)
        else:
            print(f"   ❌ Unsupported method: {method}")
            return False
        
        print(f"   Status: {response.status_code}")
        print(f"   Response time: {response.elapsed.total_seconds():.3f}s")
        
        # Check if status matches expected (can be single value or list)
        expected_statuses = expected_status if isinstance(expected_status, list) else [expected_status]
        
        if response.status_code in expected_statuses:
            try:
                response_json = response.json()
                print(f"   ✅ PASS - Response: {json.dumps(response_json, indent=2)[:200]}...")
                return True
            except:
                print(f"   ✅ PASS - Non-JSON response: {response.text[:100]}...")
                return True
        else:
            print(f"   ❌ FAIL - Expected {expected_status}, got {response.status_code}")
            print(f"   Response: {response.text[:200]}...")
            return False
            
    except requests.exceptions.Timeout:
        print(f"   ❌ FAIL - Request timed out after {TIMEOUT}s")
        return False
    except Exception as e:
        print(f"   ❌ FAIL - Error: {str(e)}")
        return False

def main():
    """Run comprehensive regression test after dead code cleanup"""
    print("="*80)
    print("🎯 BACKEND REGRESSION TEST - DEAD CODE CLEANUP VERIFICATION")
    print("   Testing after removal of ~550 lines of dead code")
    print("="*80)
    
    # Track test results
    tests_passed = 0
    tests_total = 0
    
    # =============================================================================
    # PHASE 1: VERIFY REMOVED ENDPOINTS RETURN 404/405
    # =============================================================================
    print("\n" + "="*50)
    print("PHASE 1: VERIFY REMOVED ENDPOINTS (should be 404/405)")
    print("="*50)
    
    removed_endpoints = [
        ("POST", "/api/license/scan", "Old OCR endpoint - should be removed"),
        ("POST", "/api/license/parse-pdf417", "PDF417 parser - should be removed"), 
        ("POST", "/api/license/scan-from-url", "Scan from URL - should be removed"),
    ]
    
    for method, endpoint, desc in removed_endpoints:
        tests_total += 1
        if test_endpoint(method, endpoint, expected_status=[404, 405], description=desc):
            tests_passed += 1
    
    # =============================================================================
    # PHASE 2: VERIFY SURVIVING ENDPOINTS WORK CORRECTLY
    # =============================================================================
    print("\n" + "="*50)
    print("PHASE 2: VERIFY SURVIVING ENDPOINTS (must work)")
    print("="*50)
    
    # 1. Health check
    tests_total += 1
    if test_endpoint("GET", "/api/health", description="Health check"):
        tests_passed += 1
    
    # 2. New single-step OCR endpoint
    tests_total += 1
    test_image = create_test_image(200, 200)  # Small but not too small
    files = {'image': ('test_license.jpg', test_image, 'image/jpeg')}
    if test_endpoint("POST", "/api/license/scan-direct", files=files, description="New single-step OCR endpoint"):
        tests_passed += 1
    
    # 3. Vehicle inventory
    tests_total += 1
    if test_endpoint("GET", "/api/vehicles/inventory", description="Vehicle inventory list"):
        tests_passed += 1
    
    # 4. Translation endpoint
    tests_total += 1
    translation_data = {
        "text": "Hello",
        "source_lang": "en", 
        "target_lang": "es"
    }
    if test_endpoint("POST", "/api/translate", data=translation_data, description="Translation service"):
        tests_passed += 1
    
    # 5. License upload (chunked upload should still work)
    tests_total += 1
    test_image2 = create_test_image(300, 300)
    files2 = {'image': ('test_upload.jpg', test_image2, 'image/jpeg')}
    if test_endpoint("POST", "/api/license/upload", files=files2, description="License upload (backward compatibility)"):
        tests_passed += 1
    
    # 6. Verify uploads route exists (we'll test if route is accessible)
    tests_total += 1
    if test_endpoint("GET", "/api/uploads/nonexistent.jpg", expected_status=404, description="Uploads route accessibility"):
        tests_passed += 1
    
    # 7. Create customer (uses Form data, not JSON)
    tests_total += 1
    form_data = {
        "first_name": "Test",
        "last_name": "User",
        "image_url": "/api/uploads/test.jpg"
    }
    # Convert to form data
    if test_endpoint("POST", "/api/license/create-customer", data=form_data, description="Create customer"):
        tests_passed += 1
    
    # =============================================================================
    # ADDITIONAL REGRESSION CHECKS
    # =============================================================================
    print("\n" + "="*50)
    print("PHASE 3: ADDITIONAL REGRESSION CHECKS")
    print("="*50)
    
    # Test some other critical endpoints to ensure no regressions
    additional_tests = [
        ("GET", "/api/customers/list?limit=5", None, "Customer list"),
        ("POST", "/api/tts", {"text": "Test", "voice": "nova", "language": "en"}, "Text-to-speech"),
        ("POST", "/api/tower-talk", {"situation": "Customer interested in vehicle", "inquiryType": "new_lead", "context": {}}, "Tower Talk AI"),
    ]
    
    for method, endpoint, test_data, desc in additional_tests:
        tests_total += 1
        if test_endpoint(method, endpoint, data=test_data, description=desc):
            tests_passed += 1
    
    # =============================================================================
    # RESULTS SUMMARY
    # =============================================================================
    print("\n" + "="*80)
    print("📊 REGRESSION TEST RESULTS")
    print("="*80)
    
    success_rate = (tests_passed / tests_total) * 100 if tests_total > 0 else 0
    print(f"Tests Passed: {tests_passed}/{tests_total}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 90:
        print("✅ EXCELLENT - Backend passed regression test")
        print("   Dead code cleanup successful, no critical regressions detected")
    elif success_rate >= 70:
        print("⚠️  ACCEPTABLE - Some issues found but core functionality intact") 
        print("   Review failed tests and fix if critical")
    else:
        print("❌ CRITICAL - Major regressions detected")
        print("   Dead code cleanup may have removed live code")
    
    return success_rate >= 90

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)