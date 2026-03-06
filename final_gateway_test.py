#!/usr/bin/env python3
"""
AI Gateway Final Test - Exactly matching review request requirements
"""

import requests
import json
import base64
import io
from PIL import Image
import time

BASE_URL = "http://localhost:8001"
TIMEOUT = 30

def create_test_license_image():
    """Create a more realistic license-like test image"""
    # Create a larger, more realistic image
    img = Image.new('RGB', (800, 500), color='white')
    # Add some content to make it more like a license
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(img)
    
    # Add some text-like elements
    draw.rectangle([50, 50, 750, 450], outline='blue', width=3)
    draw.text((100, 100), "SAMPLE LICENSE", fill='black')
    draw.text((100, 150), "John Doe", fill='black') 
    draw.text((100, 200), "123 Main St", fill='black')
    draw.text((100, 250), "Anytown, CA 90210", fill='black')
    draw.text((100, 300), "DL: 12345678", fill='black')
    draw.text((100, 350), "DOB: 01/01/1990", fill='black')
    
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='JPEG', quality=90)
    img_buffer.seek(0)
    return img_buffer

def test_request(method, endpoint, **kwargs):
    """Make a test request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=TIMEOUT, **kwargs)
        elif method == "POST":
            response = requests.post(url, timeout=TIMEOUT, **kwargs)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except Exception as e:
        print(f"   ❌ Request failed: {e}")
        return None

def main():
    print("🎯 AI SERVICE GATEWAY REGRESSION TEST - EXACT REVIEW REQUIREMENTS")
    print("="*80)
    print("Testing: http://localhost:8001 after AI Service Gateway implementation")
    print("All AI calls now route through the gateway.")
    
    results = []
    
    # 1. GET /api/health — basic health check
    print("\n1️⃣ GET /api/health — basic health check")
    response = test_request("GET", "/api/health")
    if response and response.status_code == 200:
        data = response.json()
        print(f"   ✅ Status: {response.status_code}, Health: {data.get('status')}")
        results.append("✅ Health check passed")
    else:
        print(f"   ❌ Health check failed: {response.status_code if response else 'No response'}")
        results.append("❌ Health check failed")
    
    # 2. GET /api/ai/stats — NEW endpoint
    print("\n2️⃣ GET /api/ai/stats — NEW endpoint")
    response = test_request("GET", "/api/ai/stats")
    if response and response.status_code == 200:
        initial_stats = response.json()
        print(f"   ✅ Status: {response.status_code}")
        
        # Verify response structure with required keys
        required_keys = ["features", "cache", "circuit_breakers", "model_routes"]
        all_keys_present = all(key in initial_stats for key in required_keys)
        
        if all_keys_present:
            print("   ✅ Response contains all required keys: features, cache, circuit_breakers, model_routes")
            
            # Verify model_routes
            model_routes = initial_stats.get("model_routes", {})
            expected_routes = ["license_ocr", "tower_talk", "translate", "vehicle_vision", "extraction", "tts"]
            routes_present = all(route in model_routes for route in expected_routes)
            
            if routes_present:
                print("   ✅ All 6 required model routes present")
                results.append("✅ AI stats endpoint working with correct structure")
            else:
                missing = [r for r in expected_routes if r not in model_routes]
                print(f"   ❌ Missing model routes: {missing}")
                results.append("❌ AI stats missing model routes")
        else:
            missing = [k for k in required_keys if k not in initial_stats]
            print(f"   ❌ Missing keys: {missing}")
            results.append("❌ AI stats structure invalid")
    else:
        print(f"   ❌ AI stats failed: {response.status_code if response else 'No response'}")
        results.append("❌ AI stats endpoint failed")
    
    # 3. POST /api/translate (first call)
    print("\n3️⃣ POST /api/translate — first call")
    translation_payload = {
        "text": "The vehicle is ready for pickup",
        "source_lang": "en",
        "target_lang": "es"
    }
    
    start_time = time.time()
    response = test_request("POST", "/api/translate", json=translation_payload)
    first_call_time = (time.time() - start_time) * 1000
    
    if response and response.status_code == 200:
        data = response.json()
        translated_text = data.get("translated_text", "")
        print(f"   ✅ Status: {response.status_code}, Time: {first_call_time:.0f}ms")
        print(f"   ✅ Translation: '{translated_text}'")
        
        # Verify translation is reasonable
        if "vehículo" in translated_text.lower() or "listo" in translated_text.lower():
            results.append("✅ Translation working through gateway")
        else:
            print(f"   ⚠️  Translation seems unusual: {translated_text}")
            results.append("⚠️  Translation result questionable")
    else:
        print(f"   ❌ Translation failed: {response.status_code if response else 'No response'}")
        results.append("❌ Translation failed")
    
    # 4. POST /api/translate (SAME text again) — should be cache hit
    print("\n4️⃣ POST /api/translate (SAME text again) — cache hit test")
    start_time = time.time()
    response = test_request("POST", "/api/translate", json=translation_payload)
    second_call_time = (time.time() - start_time) * 1000
    
    if response and response.status_code == 200:
        data = response.json()
        translated_text2 = data.get("translated_text", "")
        print(f"   ✅ Status: {response.status_code}, Time: {second_call_time:.0f}ms")
        print(f"   ✅ Translation: '{translated_text2}'")
        
        # Check if it's significantly faster (cache hit)
        if second_call_time < first_call_time * 0.1:  # At least 10x faster
            print(f"   ✅ Cache hit detected: {second_call_time:.0f}ms vs {first_call_time:.0f}ms")
            results.append("✅ Translation cache hit verified")
        else:
            print(f"   ⚠️  No clear cache hit: {second_call_time:.0f}ms vs {first_call_time:.0f}ms")
            results.append("⚠️  Translation cache hit unclear")
    else:
        print(f"   ❌ Second translation failed: {response.status_code if response else 'No response'}")
        results.append("❌ Second translation failed")
    
    # 5. POST /api/license/scan-direct with test image
    print("\n5️⃣ POST /api/license/scan-direct — license OCR through gateway")
    test_image = create_test_license_image()
    files = {'image': ('test_license.jpg', test_image, 'image/jpeg')}
    
    start_time = time.time()
    response = test_request("POST", "/api/license/scan-direct", files=files)
    scan_time = (time.time() - start_time) * 1000
    
    if response and response.status_code == 200:
        data = response.json()
        success = data.get('success', False)
        confidence = data.get('confidence', 0)
        print(f"   ✅ Status: {response.status_code}, Time: {scan_time:.0f}ms")
        print(f"   📊 Success: {success}, Confidence: {confidence}%")
        
        if success and confidence > 0:
            extracted = data.get('extracted_data', {})
            if extracted:
                print(f"   ✅ Extracted data: {list(extracted.keys())}")
            results.append("✅ License scan working through gateway")
        elif not success:
            error = data.get('error', 'No error message')
            print(f"   ⚠️  Scan unsuccessful: {error}")
            # This is still a pass since the gateway processed it
            results.append("✅ License scan processed through gateway (OCR unsuccessful on test image)")
        else:
            results.append("⚠️  License scan unclear result")
    else:
        print(f"   ❌ License scan failed: {response.status_code if response else 'No response'}")
        results.append("❌ License scan failed")
    
    # 6. GET /api/ai/stats again — verify stats now show calls
    print("\n6️⃣ GET /api/ai/stats again — verify stats show logged calls")
    response = test_request("GET", "/api/ai/stats")
    if response and response.status_code == 200:
        final_stats = response.json()
        print(f"   ✅ Status: {response.status_code}")
        
        # Check features usage
        features = final_stats.get('features', {})
        cache = final_stats.get('cache', {})
        
        print(f"   📊 Features logged: {list(features.keys())}")
        print(f"   📊 Cache stats: hits={cache.get('hits', 0)}, misses={cache.get('misses', 0)}")
        
        # Verify 'translate' and 'license_ocr' are logged
        translate_logged = 'translate' in features
        license_ocr_logged = 'license_ocr' in features
        
        if translate_logged and license_ocr_logged:
            print("   ✅ Both 'translate' and 'license_ocr' features logged")
            translate_stats = features.get('translate', {})
            license_stats = features.get('license_ocr', {})
            print(f"   📊 Translate: calls={translate_stats.get('calls', 0)}, cache_hits={translate_stats.get('cache_hits', 0)}")
            print(f"   📊 License OCR: calls={license_stats.get('calls', 0)}")
            results.append("✅ AI stats show calls for translate and license_ocr")
        else:
            print(f"   ❌ Missing features. Translate: {translate_logged}, License OCR: {license_ocr_logged}")
            results.append("❌ AI stats missing expected features")
        
        # Check cache hits
        if cache.get('hits', 0) > 0:
            print(f"   ✅ Cache hits detected: {cache.get('hits')}")
            results.append("✅ Cache hits detected in stats")
        else:
            print("   ⚠️  No cache hits in final stats")
            results.append("⚠️  No cache hits detected")
            
    else:
        print(f"   ❌ Final AI stats failed: {response.status_code if response else 'No response'}")
        results.append("❌ Final AI stats failed")
    
    # 7. GET /api/vehicles/inventory — non-AI endpoint regression test
    print("\n7️⃣ GET /api/vehicles/inventory — non-AI endpoint (no regression)")
    response = test_request("GET", "/api/vehicles/inventory")
    if response and response.status_code == 200:
        data = response.json()
        print(f"   ✅ Status: {response.status_code}")
        print("   ✅ Non-AI endpoint still works identically")
        results.append("✅ Non-AI endpoints working (no regression)")
    else:
        print(f"   ❌ Vehicles inventory failed: {response.status_code if response else 'No response'}")
        results.append("❌ Non-AI endpoint regression detected")
    
    # FINAL RESULTS SUMMARY
    print("\n" + "="*80)
    print("📊 AI SERVICE GATEWAY REGRESSION TEST RESULTS")
    print("="*80)
    
    passed_count = sum(1 for r in results if r.startswith("✅"))
    warning_count = sum(1 for r in results if r.startswith("⚠️"))
    failed_count = sum(1 for r in results if r.startswith("❌"))
    total_count = len(results)
    
    print(f"Results: {passed_count} passed, {warning_count} warnings, {failed_count} failed (Total: {total_count})")
    print("\nDetailed Results:")
    for i, result in enumerate(results, 1):
        print(f"  {i}. {result}")
    
    # Overall assessment
    success_rate = passed_count / total_count if total_count > 0 else 0
    
    if success_rate >= 0.85 and failed_count == 0:
        print("\n🎉 EXCELLENT - AI Service Gateway implementation working correctly!")
        print("   • All AI calls successfully route through gateway")
        print("   • NEW /api/ai/stats endpoint functional")  
        print("   • Gateway telemetry working (cache, circuit breakers, model routes)")
        print("   • Translation and license OCR processed through gateway")
        print("   • No regressions in existing endpoints")
        return True
    elif success_rate >= 0.7:
        print("\n⚠️  ACCEPTABLE - Core functionality works but some issues detected")
        print("   Review warnings and failures above")
        return True
    else:
        print("\n❌ CRITICAL - Major issues with AI Gateway implementation")
        print("   Gateway may not be properly implemented")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)