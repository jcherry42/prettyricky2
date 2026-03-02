#!/usr/bin/env python3
"""
Sprint 6 Backend Re-Testing Suite
Tests fixes applied to translation system endpoints based on review request
"""

import asyncio
import aiohttp
import json
import sys
import time
import base64
import io
from datetime import datetime
from typing import Dict, Any, List

# Backend URL from frontend .env
BACKEND_URL = "https://multilang-voice-fix.preview.emergentagent.com/api"

class Sprint6Tester:
    def __init__(self):
        self.session = None
        self.results = []
        self.failed_tests = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None, expected_status: int = None, actual_status: int = None):
        """Log test result with status code info"""
        result = {
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat(),
            'expected_status': expected_status,
            'actual_status': actual_status,
            'response_data': response_data
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        status_info = f" (HTTP {actual_status})" if actual_status else ""
        print(f"{status}: {test_name}{status_info}")
        if details:
            print(f"   Details: {details}")
        if not success:
            self.failed_tests.append(test_name)
    
    async def test_translate_endpoint_comprehensive(self):
        """Test POST /api/translate with all scenarios from review request"""
        print("\n🌐 Testing POST /api/translate - Comprehensive Language Tests")
        
        # Test scenarios from review request
        test_cases = [
            # Successful translations
            {"text": "Hello, how are you?", "source_lang": "en", "target_lang": "es", "expected_status": 200, "desc": "EN→ES basic greeting"},
            {"text": "I can have the car ready for you tomorrow", "source_lang": "en", "target_lang": "fr", "expected_status": 200, "desc": "EN→FR automotive context"},
            {"text": "Welcome to our dealership", "source_lang": "en", "target_lang": "ko", "expected_status": 200, "desc": "EN→KO dealership welcome"},
            {"text": "¿Cuándo puedes venir a ver el coche?", "source_lang": "es", "target_lang": "en", "expected_status": 200, "desc": "ES→EN vehicle inquiry"},
            {"text": "Je voudrais essayer cette voiture", "source_lang": "fr", "target_lang": "en", "expected_status": 200, "desc": "FR→EN test drive request"},
            {"text": "이 차를 시승해 보고 싶습니다", "source_lang": "ko", "target_lang": "en", "expected_status": 200, "desc": "KO→EN test drive request"},
            {"text": "Hello, how are you?", "source_lang": "auto", "target_lang": "es", "expected_status": 200, "desc": "Auto-detect → ES"},
            {"text": "test drive", "source_lang": "en", "target_lang": "es", "expected_status": 200, "desc": "Automotive term: test drive"},
            {"text": "trade-in value", "source_lang": "en", "target_lang": "fr", "expected_status": 200, "desc": "Automotive term: trade-in value"},
            # Edge cases that should now return HTTP 400 (fixes applied)
            {"text": "", "source_lang": "en", "target_lang": "es", "expected_status": 400, "desc": "EDGE: empty text"},
            {"text": "   ", "source_lang": "en", "target_lang": "es", "expected_status": 400, "desc": "EDGE: whitespace only"},
        ]
        
        for test_case in test_cases:
            try:
                start_time = time.time()
                
                payload = {
                    "text": test_case["text"],
                    "source_lang": test_case["source_lang"],
                    "target_lang": test_case["target_lang"]
                }
                
                async with self.session.post(f"{BACKEND_URL}/translate", json=payload) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == test_case["expected_status"]:
                        if response.status == 200:
                            data = await response.json()
                            translated_text = data.get('translated_text', '')
                            
                            if translated_text:
                                self.log_result(
                                    f"POST /translate ({test_case['desc']})",
                                    True,
                                    f"Translation: '{translated_text}' ({response_time:.0f}ms)",
                                    {"translated_text": translated_text, "response_time": response_time},
                                    test_case["expected_status"],
                                    response.status
                                )
                            else:
                                self.log_result(
                                    f"POST /translate ({test_case['desc']})",
                                    False,
                                    f"Empty translation result: {data}",
                                    data,
                                    test_case["expected_status"],
                                    response.status
                                )
                        else:  # 400 status expected for edge cases
                            error_data = await response.json()
                            self.log_result(
                                f"POST /translate ({test_case['desc']})",
                                True,
                                f"Correctly returned HTTP {response.status} for edge case",
                                {"error": error_data},
                                test_case["expected_status"],
                                response.status
                            )
                    else:
                        response_text = await response.text()
                        self.log_result(
                            f"POST /translate ({test_case['desc']})",
                            False,
                            f"Expected HTTP {test_case['expected_status']}, got {response.status}: {response_text}",
                            response_text,
                            test_case["expected_status"],
                            response.status
                        )
                        
            except Exception as e:
                self.log_result(
                    f"POST /translate ({test_case['desc']})",
                    False,
                    f"Exception: {str(e)}",
                    None,
                    test_case["expected_status"],
                    None
                )
    
    async def test_tts_endpoint_comprehensive(self):
        """Test POST /api/tts with all scenarios from review request"""
        print("\n🎤 Testing POST /api/tts - Comprehensive Text-to-Speech Tests")
        
        # Test scenarios from review request
        test_cases = [
            {"text": "Hello", "voice": "auto", "language": "en", "expected_status": 200, "desc": "English TTS"},
            {"text": "Hola", "voice": "auto", "language": "es", "expected_status": 200, "desc": "Spanish TTS"},
            {"text": "Bonjour", "voice": "auto", "language": "fr", "expected_status": 200, "desc": "French TTS"},
            {"text": "안녕하세요", "voice": "auto", "language": "ko", "expected_status": 200, "desc": "Korean TTS"},
            {"text": "", "voice": "auto", "language": "en", "expected_status": 400, "desc": "EDGE: empty text"},
            {"text": "x" * 4097, "voice": "auto", "language": "en", "expected_status": 400, "desc": "EDGE: text > 4096 chars"},
        ]
        
        # Test caching by sending same request twice
        cache_test_payload = {"text": "Hello", "voice": "auto", "language": "en"}
        
        for i, test_case in enumerate(test_cases):
            try:
                start_time = time.time()
                
                payload = {
                    "text": test_case["text"],
                    "voice": test_case["voice"],
                    "language": test_case["language"]
                }
                
                async with self.session.post(f"{BACKEND_URL}/tts", json=payload) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == test_case["expected_status"]:
                        if response.status == 200:
                            data = await response.json()
                            audio_base64 = data.get('audio_base64', '')
                            cached = data.get('cached', False)
                            
                            if audio_base64:
                                self.log_result(
                                    f"POST /tts ({test_case['desc']})",
                                    True,
                                    f"Audio generated ({len(audio_base64)} chars, cached: {cached}, {response_time:.0f}ms)",
                                    {"audio_length": len(audio_base64), "cached": cached, "response_time": response_time},
                                    test_case["expected_status"],
                                    response.status
                                )
                            else:
                                self.log_result(
                                    f"POST /tts ({test_case['desc']})",
                                    False,
                                    f"No audio_base64 in response: {data}",
                                    data,
                                    test_case["expected_status"],
                                    response.status
                                )
                        else:  # 400 status expected for edge cases
                            error_data = await response.json()
                            self.log_result(
                                f"POST /tts ({test_case['desc']})",
                                True,
                                f"Correctly returned HTTP {response.status} for edge case",
                                {"error": error_data},
                                test_case["expected_status"],
                                response.status
                            )
                    else:
                        response_text = await response.text()
                        self.log_result(
                            f"POST /tts ({test_case['desc']})",
                            False,
                            f"Expected HTTP {test_case['expected_status']}, got {response.status}: {response_text}",
                            response_text,
                            test_case["expected_status"],
                            response.status
                        )
                        
            except Exception as e:
                self.log_result(
                    f"POST /tts ({test_case['desc']})",
                    False,
                    f"Exception: {str(e)}",
                    None,
                    test_case["expected_status"],
                    None
                )
        
        # Test caching - send same request twice
        try:
            print("\n🔄 Testing TTS Caching")
            
            # First request
            start_time = time.time()
            async with self.session.post(f"{BACKEND_URL}/tts", json=cache_test_payload) as response:
                first_time = (time.time() - start_time) * 1000
                
                if response.status == 200:
                    first_data = await response.json()
                    
                    # Second request (should be cached)
                    start_time = time.time()
                    async with self.session.post(f"{BACKEND_URL}/tts", json=cache_test_payload) as response2:
                        second_time = (time.time() - start_time) * 1000
                        
                        if response2.status == 200:
                            second_data = await response2.json()
                            
                            is_cached = second_data.get('cached', False)
                            self.log_result(
                                "POST /tts (caching test)",
                                is_cached,
                                f"First: {first_time:.0f}ms, Second: {second_time:.0f}ms, Cached: {is_cached}",
                                {"first_time": first_time, "second_time": second_time, "cached": is_cached},
                                200,
                                response2.status
                            )
                        else:
                            response_text = await response2.text()
                            self.log_result(
                                "POST /tts (caching test)",
                                False,
                                f"Second request failed: HTTP {response2.status}: {response_text}",
                                None,
                                200,
                                response2.status
                            )
                else:
                    response_text = await response.text()
                    self.log_result(
                        "POST /tts (caching test)",
                        False,
                        f"First request failed: HTTP {response.status}: {response_text}",
                        None,
                        200,
                        response.status
                    )
                    
        except Exception as e:
            self.log_result(
                "POST /tts (caching test)",
                False,
                f"Exception: {str(e)}",
                None,
                200,
                None
            )
    
    async def test_voice_translate_endpoint(self):
        """Test POST /api/voice-translate with multipart/form-data - fixed validation"""
        print("\n🎙️ Testing POST /api/voice-translate - Fixed Validation")
        
        try:
            # Test 1: Invalid format (text file with .txt extension) - should return HTTP 422
            text_content = "This is not audio data"
            form_data = aiohttp.FormData()
            form_data.add_field('audio', io.BytesIO(text_content.encode()), filename='test.txt', content_type='text/plain')
            
            async with self.session.post(f"{BACKEND_URL}/voice-translate", data=form_data) as response:
                if response.status == 422:
                    error_data = await response.json()
                    self.log_result(
                        "POST /voice-translate (invalid format .txt)",
                        True,
                        f"Correctly returned HTTP 422 for text file: {error_data.get('detail', '')}",
                        {"error": error_data},
                        422,
                        response.status
                    )
                else:
                    response_text = await response.text()
                    self.log_result(
                        "POST /voice-translate (invalid format .txt)",
                        False,
                        f"Expected HTTP 422, got {response.status}: {response_text}",
                        response_text,
                        422,
                        response.status
                    )
            
            # Test 2: Empty audio file (0 bytes with audio/webm type) - should return HTTP 422
            form_data = aiohttp.FormData()
            form_data.add_field('audio', io.BytesIO(b''), filename='empty.webm', content_type='audio/webm')
            
            async with self.session.post(f"{BACKEND_URL}/voice-translate", data=form_data) as response:
                if response.status == 422:
                    error_data = await response.json()
                    self.log_result(
                        "POST /voice-translate (empty audio file)",
                        True,
                        f"Correctly returned HTTP 422 for empty file: {error_data.get('detail', '')}",
                        {"error": error_data},
                        422,
                        response.status
                    )
                else:
                    response_text = await response.text()
                    self.log_result(
                        "POST /voice-translate (empty audio file)",
                        False,
                        f"Expected HTTP 422, got {response.status}: {response_text}",
                        response_text,
                        422,
                        response.status
                    )
            
        except Exception as e:
            self.log_result(
                "POST /voice-translate (validation tests)",
                False,
                f"Exception: {str(e)}",
                None,
                422,
                None
            )
    
    async def test_tower_talk_endpoint(self):
        """Test POST /api/tower-talk with dealership scenario"""
        print("\n🗼 Testing POST /api/tower-talk - Dealership Context")
        
        try:
            payload = {
                "situation": "Customer wants to negotiate",
                "context": {
                    "customerName": "Alex",
                    "vehicle": "2024 BMW X5"
                }
            }
            
            start_time = time.time()
            async with self.session.post(f"{BACKEND_URL}/tower-talk", json=payload) as response:
                response_time = (time.time() - start_time) * 1000
                
                if response.status == 200:
                    data = await response.json()
                    response_text = data.get('response', '')
                    
                    if response_text:
                        self.log_result(
                            "POST /tower-talk (negotiation scenario)",
                            True,
                            f"Generated response ({len(response_text)} chars, {response_time:.0f}ms): {response_text[:100]}...",
                            {"response_length": len(response_text), "response_time": response_time, "preview": response_text[:100]},
                            200,
                            response.status
                        )
                    else:
                        self.log_result(
                            "POST /tower-talk (negotiation scenario)",
                            False,
                            f"Empty response: {data}",
                            data,
                            200,
                            response.status
                        )
                else:
                    response_text = await response.text()
                    self.log_result(
                        "POST /tower-talk (negotiation scenario)",
                        False,
                        f"HTTP {response.status}: {response_text}",
                        response_text,
                        200,
                        response.status
                    )
                    
        except Exception as e:
            self.log_result(
                "POST /tower-talk (negotiation scenario)",
                False,
                f"Exception: {str(e)}",
                None,
                200,
                None
            )
    
    def print_summary(self):
        """Print comprehensive test summary"""
        total_tests = len(self.results)
        passed_tests = total_tests - len(self.failed_tests)
        pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"\n{'='*80}")
        print(f"🎯 SPRINT 6 RE-TEST SUMMARY")
        print(f"{'='*80}")
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Pass Rate: {pass_rate:.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test}")
        
        print(f"\n{'='*80}")
        
        # Detailed results by endpoint
        endpoints = {}
        for result in self.results:
            endpoint = result['test'].split(' (')[0]  # Get endpoint name before description
            if endpoint not in endpoints:
                endpoints[endpoint] = {'passed': 0, 'failed': 0, 'details': []}
            
            if result['success']:
                endpoints[endpoint]['passed'] += 1
            else:
                endpoints[endpoint]['failed'] += 1
            
            endpoints[endpoint]['details'].append(result)
        
        for endpoint, stats in endpoints.items():
            total = stats['passed'] + stats['failed']
            rate = (stats['passed'] / total * 100) if total > 0 else 0
            status = "✅" if stats['failed'] == 0 else "❌"
            print(f"{status} {endpoint}: {stats['passed']}/{total} ({rate:.1f}%)")
            
            # Show failures
            if stats['failed'] > 0:
                for detail in stats['details']:
                    if not detail['success']:
                        expected = detail['expected_status']
                        actual = detail['actual_status']
                        status_info = f" (Expected: {expected}, Got: {actual})" if expected and actual else ""
                        print(f"    ❌ {detail['test']}{status_info}: {detail['details']}")

async def main():
    print("🚀 Starting Sprint 6 Backend Re-Testing Suite")
    print("Testing fixes applied to translation system endpoints")
    print(f"Backend URL: {BACKEND_URL}")
    print("="*80)
    
    async with Sprint6Tester() as tester:
        # Test all endpoints as specified in review request
        await tester.test_translate_endpoint_comprehensive()
        await tester.test_tts_endpoint_comprehensive()
        await tester.test_voice_translate_endpoint()
        await tester.test_tower_talk_endpoint()
        
        # Print comprehensive summary
        tester.print_summary()
        
        # Return exit code based on results
        if tester.failed_tests:
            print(f"\n❌ Testing completed with {len(tester.failed_tests)} failures")
            return 1
        else:
            print(f"\n✅ All tests passed successfully!")
            return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)