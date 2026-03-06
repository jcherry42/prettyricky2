#!/usr/bin/env python3
"""
AI Gateway Focused Test - Exactly as specified in review request
"""

import requests
import json
import base64
import io
from PIL import Image
import time

BASE_URL = "http://localhost:8001"

def create_realistic_test_image():
    """Create a larger, more realistic test image"""
    img = Image.new('RGB', (800, 600), color='lightgray')
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='JPEG', quality=95)
    img_buffer.seek(0)
    return img_buffer

def main():
    print("🎯 AI SERVICE GATEWAY REGRESSION TEST - Exact Review Requirements")
    print("="*80)
    
    # Test 1: Health Check
    print("\n1️⃣ GET /api/health")
    response = requests.get(f"{BASE_URL}/api/health")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Health: {data.get('status', 'unknown')}")
    
    # Test 2: AI Gateway Stats (Initial)
    print("\n2️⃣ GET /api/ai/stats (Initial)")  
    response = requests.get(f"{BASE_URL}/api/ai/stats")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        initial_stats = response.json()
        print(f"   ✅ Features: {list(initial_stats.get('features', {}).keys())}")
        print(f"   ✅ Cache: {initial_stats.get('cache', {})}")
        print(f"   ✅ Circuit breakers: {initial_stats.get('circuit_breakers', {})}")
        print(f"   ✅ Model routes: {len(initial_stats.get('model_routes', {}))}")
        
        # Validate all expected model routes
        expected_routes = ["license_ocr", "tower_talk", "translate", "vehicle_vision", "extraction", "tts"]
        model_routes = initial_stats.get('model_routes', {})
        print("   🔍 Model route validation:")
        for route in expected_routes:
            if route in model_routes:
                print(f"      ✅ {route}: {model_routes[route]}")
            else:
                print(f"      ❌ {route}: MISSING")
    
    # Test 3: First Translation Call
    print("\n3️⃣ POST /api/translate (First Call)")
    payload = {
        "text": "The vehicle is ready for pickup",
        "source_lang": "en",
        "target_lang": "es"
    }
    start_time = time.time()
    response = requests.post(f"{BASE_URL}/api/translate", json=payload)
    elapsed = time.time() - start_time
    print(f"   Status: {response.status_code}")
    print(f"   Time: {elapsed*1000:.0f}ms")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Translation: '{data.get('translated_text', 'N/A')}'")
    
    # Test 4: Second Translation Call (Same Text - Should Cache Hit)
    print("\n4️⃣ POST /api/translate (Same Text - Cache Hit)")
    start_time = time.time()
    response = requests.post(f"{BASE_URL}/api/translate", json=payload)
    elapsed = time.time() - start_time
    print(f"   Status: {response.status_code}")
    print(f"   Time: {elapsed*1000:.0f}ms (should be much faster)")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Translation: '{data.get('translated_text', 'N/A')}'")
    
    # Test 5: License Scan Direct
    print("\n5️⃣ POST /api/license/scan-direct")
    test_image = create_realistic_test_image()
    files = {'image': ('test_license.jpg', test_image, 'image/jpeg')}
    
    start_time = time.time()
    response = requests.post(f"{BASE_URL}/api/license/scan-direct", files=files)
    elapsed = time.time() - start_time
    print(f"   Status: {response.status_code}")
    print(f"   Time: {elapsed*1000:.0f}ms")
    if response.status_code == 200:
        data = response.json()
        success = data.get('success', False)
        confidence = data.get('confidence', 0)
        print(f"   ✅ Success: {success}, Confidence: {confidence}%")
        if 'extracted_data' in data and data['extracted_data']:
            print(f"   ✅ Extracted fields: {list(data['extracted_data'].keys())}")
        if 'error' in data and data['error']:
            print(f"   ⚠️  Error: {data['error']}")
    
    # Test 6: AI Gateway Stats (After Usage)
    print("\n6️⃣ GET /api/ai/stats (After Usage)")
    response = requests.get(f"{BASE_URL}/api/ai/stats")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        final_stats = response.json()
        
        # Check features usage
        features = final_stats.get('features', {})
        print(f"   📊 Features logged: {list(features.keys())}")
        
        for feature_name, feature_stats in features.items():
            print(f"      📈 {feature_name}: calls={feature_stats.get('calls', 0)}, "
                  f"cache_hits={feature_stats.get('cache_hits', 0)}, "
                  f"errors={feature_stats.get('errors', 0)}")
        
        # Check cache stats
        cache = final_stats.get('cache', {})
        print(f"   📊 Cache: hits={cache.get('hits', 0)}, misses={cache.get('misses', 0)}, "
              f"hit_rate={cache.get('hit_rate', 0)}")
        
        # Verify expected behavior
        translate_stats = features.get('translate', {})
        license_ocr_stats = features.get('license_ocr', {})
        
        print("\n   🔍 Critical Checks:")
        
        # Check if translate feature logged calls
        if translate_stats and translate_stats.get('calls', 0) >= 2:
            print("   ✅ Translate feature logged multiple calls")
        else:
            print("   ❌ Translate feature not properly logged")
        
        # Check if license_ocr feature logged
        if license_ocr_stats and license_ocr_stats.get('calls', 0) >= 1:
            print("   ✅ License OCR feature logged")
        else:
            print("   ❌ License OCR feature not logged")
        
        # Check for cache hits  
        if cache.get('hits', 0) > 0:
            print("   ✅ Cache hits detected (caching working)")
        else:
            print("   ❌ No cache hits detected")
        
        # Check circuit breakers
        cb = final_stats.get('circuit_breakers', {})
        if cb:
            print(f"   ✅ Circuit breakers status: {cb}")
        else:
            print("   ❌ Circuit breakers not found")
    
    # Test 7: Non-AI Endpoint
    print("\n7️⃣ GET /api/vehicles/inventory (Non-AI endpoint)")
    response = requests.get(f"{BASE_URL}/api/vehicles/inventory")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("   ✅ Non-AI endpoint working (no regression)")

if __name__ == "__main__":
    main()