#!/usr/bin/env python3
"""
Quick Backend Regression Test as specified in review request
"""

import asyncio
import aiohttp
import json
import sys

# Use the backend URL from the review request
BACKEND_URL = "https://backend-sync-15.preview.emergentagent.com/api"

async def run_requested_tests():
    """Run the specific 6 tests mentioned in the review request"""
    print("🎯 Running Quick Backend Regression Tests as requested")
    print(f"Backend URL: {BACKEND_URL}")
    print("="*60)
    
    results = []
    
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
        
        # Test 1: GET /api/health → expect 200 with {"status": "healthy"}
        try:
            async with session.get(f"{BACKEND_URL}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("status") == "healthy":
                        results.append("1. GET /api/health: ✅ PASS")
                    else:
                        results.append(f"1. GET /api/health: ❌ FAIL - Expected status='healthy', got: {data}")
                else:
                    results.append(f"1. GET /api/health: ❌ FAIL - HTTP {response.status}")
        except Exception as e:
            results.append(f"1. GET /api/health: ❌ FAIL - Exception: {str(e)}")
        
        # Test 2: GET /api/customers/list?limit=3 → expect 200 with customers array
        try:
            async with session.get(f"{BACKEND_URL}/customers/list?limit=3") as response:
                if response.status == 200:
                    data = await response.json()
                    if "customers" in data:
                        customers_count = len(data.get("customers", []))
                        total = data.get("total", 0)
                        results.append(f"2. GET /api/customers/list?limit=3: ✅ PASS (Found {customers_count} customers, total: {total})")
                    else:
                        results.append(f"2. GET /api/customers/list?limit=3: ❌ FAIL - Missing 'customers' field")
                else:
                    results.append(f"2. GET /api/customers/list?limit=3: ❌ FAIL - HTTP {response.status}")
        except Exception as e:
            results.append(f"2. GET /api/customers/list?limit=3: ❌ FAIL - Exception: {str(e)}")
        
        # Test 3: POST /api/translate with success case
        try:
            payload = {
                "text": "Hello friend", 
                "source_lang": "en", 
                "target_lang": "es"
            }
            async with session.post(f"{BACKEND_URL}/translate", json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    if "translated_text" in data:
                        translated = data.get("translated_text", "")
                        results.append(f"3. POST /api/translate (success): ✅ PASS ('{translated}')")
                    else:
                        results.append(f"3. POST /api/translate (success): ❌ FAIL - Missing 'translated_text'")
                else:
                    results.append(f"3. POST /api/translate (success): ❌ FAIL - HTTP {response.status}")
        except Exception as e:
            results.append(f"3. POST /api/translate (success): ❌ FAIL - Exception: {str(e)}")
        
        # Test 4: POST /api/translate with empty text → expect 400
        try:
            payload = {
                "text": "", 
                "source_lang": "en", 
                "target_lang": "es"
            }
            async with session.post(f"{BACKEND_URL}/translate", json=payload) as response:
                if response.status == 400:
                    results.append("4. POST /api/translate (empty validation): ✅ PASS (Correctly returned 400)")
                else:
                    results.append(f"4. POST /api/translate (empty validation): ❌ FAIL - Expected 400, got {response.status}")
        except Exception as e:
            results.append(f"4. POST /api/translate (empty validation): ❌ FAIL - Exception: {str(e)}")
        
        # Test 5: POST /api/tts → expect 200
        try:
            payload = {
                "text": "Testing", 
                "voice": "auto", 
                "language": "en"
            }
            async with session.post(f"{BACKEND_URL}/tts", json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    if "audio_base64" in data:
                        audio_length = len(data.get("audio_base64", ""))
                        results.append(f"5. POST /api/tts: ✅ PASS (Audio length: {audio_length})")
                    else:
                        results.append(f"5. POST /api/tts: ❌ FAIL - Missing 'audio_base64'")
                else:
                    results.append(f"5. POST /api/tts: ❌ FAIL - HTTP {response.status}")
        except Exception as e:
            results.append(f"5. POST /api/tts: ❌ FAIL - Exception: {str(e)}")
        
        # Test 6: POST /api/tower-talk → expect 200
        try:
            payload = {
                "situation": "Customer asking about financing", 
                "context": {"customerName": "Test"}
            }
            async with session.post(f"{BACKEND_URL}/tower-talk", json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    if "response" in data:
                        response_length = len(data.get("response", ""))
                        results.append(f"6. POST /api/tower-talk: ✅ PASS (Response length: {response_length})")
                    else:
                        results.append(f"6. POST /api/tower-talk: ❌ FAIL - Missing 'response'")
                else:
                    results.append(f"6. POST /api/tower-talk: ❌ FAIL - HTTP {response.status}")
        except Exception as e:
            results.append(f"6. POST /api/tower-talk: ❌ FAIL - Exception: {str(e)}")
    
    # Print results
    print("\n📊 QUICK REGRESSION TEST RESULTS:")
    print("="*60)
    for result in results:
        print(result)
    
    # Count pass/fail
    passed = len([r for r in results if "✅ PASS" in r])
    failed = len([r for r in results if "❌ FAIL" in r])
    
    print(f"\n🎯 Final Score: {passed}/6 PASS, {failed}/6 FAIL")
    
    return failed == 0

if __name__ == "__main__":
    success = asyncio.run(run_requested_tests())
    if success:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print("\n💥 SOME TESTS FAILED!")
        sys.exit(1)