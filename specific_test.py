#!/usr/bin/env python3
"""
Specific Test Cases from Review Request
Testing exact scenarios mentioned in the dead code cleanup review
"""

import requests
import json
import base64
import os
import io
from PIL import Image
import sys

BASE_URL = "http://localhost:8001"
TIMEOUT = 30

def create_small_test_image():
    """Create a small test image as requested in review"""
    img = Image.new('RGB', (50, 50), color='blue')  # Very small image
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='JPEG')
    img_buffer.seek(0)
    return img_buffer

def test_specific_cases():
    """Test the exact cases mentioned in the review request"""
    print("="*80)
    print("🎯 SPECIFIC TEST CASES FROM REVIEW REQUEST")
    print("="*80)
    
    results = []
    
    # 1. Health check
    print("\n1. Testing GET /api/health")
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        results.append(("Health Check", response.status_code == 200))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Health Check", False))
    
    # 2. New single-step OCR with small image file
    print("\n2. Testing POST /api/license/scan-direct with small image file")
    try:
        small_image = create_small_test_image()
        files = {'image': ('small_test.jpg', small_image, 'image/jpeg')}
        response = requests.post(f"{BASE_URL}/api/license/scan-direct", files=files, timeout=TIMEOUT)
        print(f"   Status: {response.status_code}")
        response_json = response.json()
        print(f"   Success: {response_json.get('success')}")
        print(f"   Error: {response_json.get('error', 'None')}")
        # Should handle small images gracefully
        results.append(("Scan Direct Small Image", response.status_code == 200))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Scan Direct Small Image", False))
    
    # 3. Vehicle inventory
    print("\n3. Testing GET /api/vehicles/inventory")
    try:
        response = requests.get(f"{BASE_URL}/api/vehicles/inventory", timeout=TIMEOUT)
        print(f"   Status: {response.status_code}")
        response_json = response.json()
        print(f"   Vehicles: {len(response_json.get('vehicles', []))}")
        print(f"   Counts: {response_json.get('counts')}")
        results.append(("Vehicle Inventory", response.status_code == 200))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Vehicle Inventory", False))
    
    # 4. Translation with exact body from review request
    print('\n4. Testing POST /api/translate with {"text": "Hello", "source_lang": "en", "target_lang": "es"}')
    try:
        data = {"text": "Hello", "source_lang": "en", "target_lang": "es"}
        response = requests.post(f"{BASE_URL}/api/translate", json=data, timeout=TIMEOUT)
        print(f"   Status: {response.status_code}")
        response_json = response.json()
        print(f"   Translated: '{response_json.get('translated_text')}'")
        results.append(("Translation EN→ES", response.status_code == 200 and response_json.get('translated_text')))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Translation EN→ES", False))
    
    # 5. License upload (chunked upload still works)
    print("\n5. Testing POST /api/license/upload (chunked upload compatibility)")
    try:
        test_image = create_small_test_image()
        files = {'image': ('test_license.jpg', test_image, 'image/jpeg')}
        response = requests.post(f"{BASE_URL}/api/license/upload", files=files, timeout=TIMEOUT)
        print(f"   Status: {response.status_code}")
        response_json = response.json()
        print(f"   Success: {response_json.get('success')}")
        print(f"   Image URL: {response_json.get('image_url')}")
        results.append(("License Upload", response.status_code == 200 and response_json.get('success')))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("License Upload", False))
    
    # 6. Verify uploads route exists
    print("\n6. Testing GET /api/uploads/{file} route exists")
    try:
        # Test with a non-existent file to verify route exists (should get 404, not 405)
        response = requests.get(f"{BASE_URL}/api/uploads/test-file.jpg", timeout=TIMEOUT)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        # 404 means route exists but file doesn't; 405 would mean route doesn't exist
        results.append(("Uploads Route", response.status_code == 404))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Uploads Route", False))
    
    # 7. Create customer with exact body from review request
    print('\n7. Testing POST /api/license/create-customer with {"first_name": "Test", "last_name": "User"}')
    try:
        # This endpoint uses form data
        data = {"first_name": "Test", "last_name": "User", "image_url": "/api/uploads/test.jpg"}
        response = requests.post(f"{BASE_URL}/api/license/create-customer", data=data, timeout=TIMEOUT)
        print(f"   Status: {response.status_code}")
        response_json = response.json()
        print(f"   Success: {response_json.get('success')}")
        print(f"   Customer ID: {response_json.get('customer', {}).get('id')}")
        results.append(("Create Customer", response.status_code == 200 and response_json.get('success')))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Create Customer", False))
    
    # Test removed endpoints return 404/405
    print("\n8. Verifying REMOVED endpoints return 404/405")
    removed_endpoints = [
        "POST /api/license/scan",
        "POST /api/license/parse-pdf417", 
        "POST /api/license/scan-from-url"
    ]
    
    for endpoint_desc in removed_endpoints:
        method, path = endpoint_desc.split(' ', 1)
        try:
            response = requests.post(f"{BASE_URL}{path}", timeout=TIMEOUT)
            print(f"   {endpoint_desc}: {response.status_code}")
            results.append((f"Removed {path}", response.status_code in [404, 405]))
        except Exception as e:
            print(f"   ❌ {endpoint_desc} Error: {e}")
            results.append((f"Removed {path}", False))
    
    # Summary
    print("\n" + "="*80)
    print("📊 SPECIFIC TEST RESULTS")
    print("="*80)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("✅ ALL TESTS PASSED - Dead code cleanup verification successful!")
    else:
        print("⚠️  Some tests failed - Review needed")
    
    return passed == total

if __name__ == "__main__":
    success = test_specific_cases()
    sys.exit(0 if success else 1)