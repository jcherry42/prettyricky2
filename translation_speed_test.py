#!/usr/bin/env python3
"""
Translation Endpoint Speed Test
Tests the translation endpoint speed with specific test cases and measures response times.
Focus on gpt-4o-mini performance and cache hit verification.
"""

import asyncio
import aiohttp
import json
import sys
import time
from typing import Dict, Any

# Test configuration
BASE_URL = "http://localhost:8001"

class TranslationTest:
    def __init__(self, name: str, text: str, source_lang: str, target_lang: str):
        self.name = name
        self.text = text
        self.source_lang = source_lang
        self.target_lang = target_lang
        self.response_time = 0
        self.success = False
        self.response_data = None
        self.translated_text = ""
        self.error = ""

async def test_translation(test: TranslationTest) -> TranslationTest:
    """Test a single translation request and measure response time"""
    
    payload = {
        "text": test.text,
        "source_lang": test.source_lang,
        "target_lang": test.target_lang
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            
            async with session.post(f"{BASE_URL}/api/translate", json=payload) as response:
                end_time = time.time()
                test.response_time = round((end_time - start_time) * 1000, 2)  # Convert to milliseconds
                
                response_data = await response.json()
                test.response_data = response_data
                
                if response.status == 200 and 'translated_text' in response_data:
                    test.success = True
                    test.translated_text = response_data.get('translated_text', '')
                else:
                    test.error = f"Status: {response.status}, Response: {response_data}"
                    
    except Exception as e:
        test.error = f"Request failed: {str(e)}"
        
    return test

async def run_translation_speed_tests():
    """Run the specific translation speed tests as requested"""
    
    print("Starting Translation Endpoint Speed Tests...")
    print(f"Base URL: {BASE_URL}")
    print("Testing gpt-4o-mini performance and cache hit verification\n")
    
    # Define the exact test cases from the review request
    tests = [
        TranslationTest(
            name="Test 1: English → Spanish (Vehicle Sales)",
            text="I've got this vehicle here and it's a strong choice. When can you swing by so we can walk it in person?",
            source_lang="en",
            target_lang="es"
        ),
        TranslationTest(
            name="Test 2: English → French (Vehicle Availability)",
            text="The vehicle you asked about is available and worth a look in person.",
            source_lang="en",
            target_lang="fr"
        ),
        TranslationTest(
            name="Test 3: English → Korean (Vehicle Inspection)",
            text="Let's get you eyes on it. It's easier to make a call when you're here with the vehicle.",
            source_lang="en",
            target_lang="ko"
        ),
        TranslationTest(
            name="Test 4: English → Japanese (Value Proposition)",
            text="Price is one part of the deal. When you're here I can show you exactly where the value is.",
            source_lang="en",
            target_lang="ja"
        ),
        TranslationTest(
            name="Test 5: Repeat Test 1 (Cache Hit Verification)",
            text="I've got this vehicle here and it's a strong choice. When can you swing by so we can walk it in person?",
            source_lang="en",
            target_lang="es"
        )
    ]
    
    results = []
    
    # Run each test
    for i, test in enumerate(tests, 1):
        print(f"Running {test.name}...")
        result = await test_translation(test)
        results.append(result)
        
        if result.success:
            print(f"✅ SUCCESS - {result.response_time}ms")
            print(f"   Original: {result.text}")
            print(f"   Translated: {result.translated_text}")
        else:
            print(f"❌ FAILED - {result.response_time}ms")
            print(f"   Error: {result.error}")
        print()
    
    # Print summary
    print("="*80)
    print("TRANSLATION SPEED TEST RESULTS SUMMARY")
    print("="*80)
    
    successful_tests = [r for r in results if r.success]
    failed_tests = [r for r in results if not r.success]
    
    if successful_tests:
        avg_response_time = sum(r.response_time for r in successful_tests) / len(successful_tests)
        min_response_time = min(r.response_time for r in successful_tests)
        max_response_time = max(r.response_time for r in successful_tests)
        
        print(f"Successful Tests: {len(successful_tests)}/{len(results)}")
        print(f"Average Response Time: {avg_response_time:.2f}ms")
        print(f"Fastest Response: {min_response_time}ms")
        print(f"Slowest Response: {max_response_time}ms")
        
        # Check cache hit performance (Test 5 should be significantly faster than Test 1)
        if len(successful_tests) >= 5:
            test1_time = results[0].response_time if results[0].success else None
            test5_time = results[4].response_time if results[4].success else None
            
            if test1_time and test5_time:
                speedup = test1_time / test5_time if test5_time > 0 else 1
                cache_hit_detected = test5_time < test1_time * 0.5  # Cache hit should be at least 50% faster
                
                print(f"\nCache Hit Analysis:")
                print(f"Test 1 (First): {test1_time}ms")
                print(f"Test 5 (Repeat): {test5_time}ms")
                print(f"Speedup: {speedup:.1f}x")
                print(f"Cache Hit Detected: {'✅ YES' if cache_hit_detected else '❌ NO'}")
    
    if failed_tests:
        print(f"\nFailed Tests: {len(failed_tests)}")
        for test in failed_tests:
            print(f"  - {test.name}: {test.error}")
    
    print("="*80)
    
    return results

async def main():
    """Main test runner"""
    results = await run_translation_speed_tests()
    
    # Return success if all tests passed
    success_count = sum(1 for r in results if r.success)
    return 0 if success_count == len(results) else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)