"""
PTT Voice Translation Pipeline Backend Test Suite
Testing the critical voice translation bug fixes as requested in review.

CRITICAL CONTEXT: Three major bugs were fixed in the voice-translate endpoint:
1. UserMessage(message=transcript) was wrong — UserMessage takes text= parameter. Fixed.
2. LlmChat constructor doesn't accept model= directly — needs .with_model(). Fixed.
3. Upgraded translation to gpt-4o with automotive context. Fixed.

TESTS TO RUN:
1. Health Check: GET /api/health → expect 200 with status "healthy"
2. Voice Translation - All 8 language paths (main focus)
3. Voice Translation Edge Cases
4. TTS - All 4 languages  
5. Text Translation
6. Tower Talk Regression
7. Customer List Regression
"""

import asyncio
import aiohttp
import json
import base64
import os
import tempfile
from typing import Dict, Any, Optional
import time

# Backend URL configuration
BACKEND_URL = "http://localhost:8001"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        self.start_time = time.time()
    
    def add_result(self, test_name: str, passed: bool, details: str = "", response_time: Optional[float] = None):
        result_entry = {
            'test': test_name,
            'passed': passed,
            'details': details,
            'response_time': response_time
        }
        self.results.append(result_entry)
        
        if passed:
            self.passed += 1
            time_info = f" ({response_time:.2f}s)" if response_time else ""
            print(f"✅ {test_name}{time_info}")
        else:
            self.failed += 1
            time_info = f" ({response_time:.2f}s)" if response_time else ""
            print(f"❌ {test_name}{time_info}: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        total_time = time.time() - self.start_time
        print(f"\n🎯 TEST SUMMARY: {self.passed}/{total} passed ({(self.passed/total)*100:.1f}% pass rate)")
        print(f"⏱️  Total execution time: {total_time:.1f}s")
        
        if self.failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['details']}")

async def generate_test_audio_via_tts(session: aiohttp.ClientSession, text: str, language: str) -> Optional[bytes]:
    """Generate test audio using the TTS endpoint"""
    tts_request = {
        "text": text,
        "voice": "auto",
        "language": language
    }
    
    try:
        async with session.post(f"{BACKEND_URL}/api/tts", json=tts_request) as resp:
            if resp.status == 200:
                data = await resp.json()
                audio_base64 = data.get('audio_base64')
                if audio_base64:
                    return base64.b64decode(audio_base64)
    except Exception as e:
        print(f"⚠️  Failed to generate TTS audio for {language}: {e}")
    
    return None

async def test_health_check() -> TestResults:
    """Test 1: Health Check - GET /api/health → expect 200 with status 'healthy'"""
    results = TestResults()
    
    async with aiohttp.ClientSession() as session:
        try:
            start_time = time.time()
            async with session.get(f"{BACKEND_URL}/api/health") as resp:
                response_time = time.time() - start_time
                data = await resp.json()
                
                if resp.status == 200 and data.get('status') == 'healthy':
                    results.add_result("Health Check", True, response_time=response_time)
                else:
                    results.add_result("Health Check", False, 
                                     f"Expected status 200 with 'healthy'. Got: {resp.status}, {data}",
                                     response_time=response_time)
        except Exception as e:
            results.add_result("Health Check", False, f"Exception: {e}")
    
    return results

async def test_voice_translation_all_paths() -> TestResults:
    """Test 2: Voice Translation - All 8 language paths (MAIN focus)"""
    results = TestResults()
    
    # Test automotive phrases for each language
    test_phrases = {
        'en': "I would like to schedule a test drive for the BMW X5.",
        'es': "Me gustaría programar una prueba de manejo para el BMW X5.",
        'fr': "J'aimerais programmer un essai routier pour le BMW X5.",
        'ko': "BMW X5 시승을 예약하고 싶습니다."
    }
    
    # All 8 language paths to test
    language_paths = [
        ('en', 'es', "English to Spanish"),
        ('es', 'en', "Spanish to English"), 
        ('en', 'fr', "English to French"),
        ('fr', 'en', "French to English"),
        ('en', 'ko', "English to Korean"),
        ('ko', 'en', "Korean to English"),
        ('es', 'fr', "Spanish to French"),  # Additional automotive paths
        ('fr', 'ko', "French to Korean")
    ]
    
    async with aiohttp.ClientSession() as session:
        
        for source_lang, target_lang, description in language_paths:
            try:
                # Generate test audio using TTS
                test_text = test_phrases.get(source_lang, test_phrases['en'])
                audio_data = await generate_test_audio_via_tts(session, test_text, source_lang)
                
                if not audio_data:
                    results.add_result(f"Voice Translation: {description}", False, 
                                     "Failed to generate test audio via TTS")
                    continue
                
                # Create a temporary audio file
                with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
                    temp_file.write(audio_data)
                    temp_file.flush()
                    
                    # Prepare multipart form data
                    data = aiohttp.FormData()
                    data.add_field('audio', open(temp_file.name, 'rb'), 
                                 filename='test_audio.mp3', content_type='audio/mp3')
                    data.add_field('source_lang', source_lang)
                    data.add_field('target_lang', target_lang)
                    
                    start_time = time.time()
                    async with session.post(f"{BACKEND_URL}/api/voice-translate", 
                                          data=data) as resp:
                        response_time = time.time() - start_time
                        response_data = await resp.json()
                        
                        # Check for successful voice translation
                        if (resp.status == 200 and 
                            response_data.get('success') == True and
                            response_data.get('transcript') and
                            response_data.get('translated_text') and
                            response_data.get('source_lang') == source_lang and
                            response_data.get('target_lang') == target_lang):
                            
                            results.add_result(f"Voice Translation: {description}", True,
                                             f"Transcript: '{response_data.get('transcript')[:50]}...', "
                                             f"Translation: '{response_data.get('translated_text')[:50]}...'",
                                             response_time=response_time)
                        else:
                            results.add_result(f"Voice Translation: {description}", False,
                                             f"Status: {resp.status}, Response: {response_data}",
                                             response_time=response_time)
                
                # Clean up temp file
                os.unlink(temp_file.name)
                    
            except Exception as e:
                results.add_result(f"Voice Translation: {description}", False, f"Exception: {e}")
    
    return results

async def test_voice_translation_edge_cases() -> TestResults:
    """Test 3: Voice Translation Edge Cases"""
    results = TestResults()
    
    async with aiohttp.ClientSession() as session:
        
        # Test Case A: Empty audio file → expect 422
        try:
            data = aiohttp.FormData()
            data.add_field('audio', b'', filename='empty.mp3', content_type='audio/mp3')
            data.add_field('source_lang', 'en')
            data.add_field('target_lang', 'es')
            
            start_time = time.time()
            async with session.post(f"{BACKEND_URL}/api/voice-translate", data=data) as resp:
                response_time = time.time() - start_time
                
                if resp.status == 422:
                    results.add_result("Edge Case: Empty audio file", True, response_time=response_time)
                else:
                    response_data = await resp.json()
                    results.add_result("Edge Case: Empty audio file", False,
                                     f"Expected 422, got {resp.status}: {response_data}",
                                     response_time=response_time)
        except Exception as e:
            results.add_result("Edge Case: Empty audio file", False, f"Exception: {e}")
        
        # Test Case B: Same source and target language → expect success with transcript == translated_text
        try:
            # Generate test audio
            audio_data = await generate_test_audio_via_tts(session, "Hello automotive customer", "en")
            
            if audio_data:
                with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
                    temp_file.write(audio_data)
                    temp_file.flush()
                    
                    data = aiohttp.FormData()
                    data.add_field('audio', open(temp_file.name, 'rb'),
                                 filename='test_same_lang.mp3', content_type='audio/mp3')
                    data.add_field('source_lang', 'en')
                    data.add_field('target_lang', 'en')
                    
                    start_time = time.time()
                    async with session.post(f"{BACKEND_URL}/api/voice-translate", data=data) as resp:
                        response_time = time.time() - start_time
                        response_data = await resp.json()
                        
                        if (resp.status == 200 and 
                            response_data.get('success') == True and
                            response_data.get('transcript') == response_data.get('translated_text')):
                            
                            results.add_result("Edge Case: Same source/target language", True,
                                             response_time=response_time)
                        else:
                            results.add_result("Edge Case: Same source/target language", False,
                                             f"Expected transcript == translated_text. Got: {response_data}",
                                             response_time=response_time)
                
                os.unlink(temp_file.name)
            else:
                results.add_result("Edge Case: Same source/target language", False,
                                 "Failed to generate test audio")
                
        except Exception as e:
            results.add_result("Edge Case: Same source/target language", False, f"Exception: {e}")
    
    return results

async def test_tts_all_languages() -> TestResults:
    """Test 4: TTS - All 4 languages"""
    results = TestResults()
    
    test_cases = [
        ("en", "Welcome to our automotive dealership"),
        ("es", "Bienvenido a nuestro concesionario automotriz"),
        ("fr", "Bienvenue dans notre concession automobile"),
        ("ko", "자동차 대리점에 오신 것을 환영합니다")
    ]
    
    async with aiohttp.ClientSession() as session:
        
        for language, text in test_cases:
            try:
                tts_request = {
                    "text": text,
                    "voice": "auto",
                    "language": language
                }
                
                start_time = time.time()
                async with session.post(f"{BACKEND_URL}/api/tts", json=tts_request) as resp:
                    response_time = time.time() - start_time
                    data = await resp.json()
                    
                    if (resp.status == 200 and 
                        data.get('audio_base64') and 
                        data.get('voice_used')):
                        
                        audio_size = len(data.get('audio_base64', ''))
                        results.add_result(f"TTS: {language.upper()}", True,
                                         f"Generated audio: {audio_size} chars base64",
                                         response_time=response_time)
                    else:
                        results.add_result(f"TTS: {language.upper()}", False,
                                         f"Status: {resp.status}, Response: {data}",
                                         response_time=response_time)
                        
            except Exception as e:
                results.add_result(f"TTS: {language.upper()}", False, f"Exception: {e}")
    
    return results

async def test_text_translation() -> TestResults:
    """Test 5: Text Translation"""
    results = TestResults()
    
    test_cases = [
        ("en", "es", "I need to schedule a test drive"),
        ("en", "fr", "I need to schedule a test drive"),
        ("en", "ko", "I need to schedule a test drive")
    ]
    
    async with aiohttp.ClientSession() as session:
        
        for source_lang, target_lang, text in test_cases:
            try:
                translate_request = {
                    "text": text,
                    "source_lang": source_lang,
                    "target_lang": target_lang
                }
                
                start_time = time.time()
                async with session.post(f"{BACKEND_URL}/api/translate", json=translate_request) as resp:
                    response_time = time.time() - start_time
                    data = await resp.json()
                    
                    if (resp.status == 200 and data.get('translated_text')):
                        results.add_result(f"Translation: {source_lang.upper()}→{target_lang.upper()}", True,
                                         f"'{text}' → '{data.get('translated_text')}'",
                                         response_time=response_time)
                    else:
                        results.add_result(f"Translation: {source_lang.upper()}→{target_lang.upper()}", False,
                                         f"Status: {resp.status}, Response: {data}",
                                         response_time=response_time)
                        
            except Exception as e:
                results.add_result(f"Translation: {source_lang.upper()}→{target_lang.upper()}", False, f"Exception: {e}")
    
    return results

async def test_tower_talk_regression() -> TestResults:
    """Test 6: Tower Talk Regression"""
    results = TestResults()
    
    async with aiohttp.ClientSession() as session:
        
        try:
            tower_talk_request = {
                "situation": "Customer wants to negotiate price",
                "inquiryType": "price_question",
                "context": {
                    "customerName": "John",
                    "vehicle": "2024 BMW X5"
                }
            }
            
            start_time = time.time()
            async with session.post(f"{BACKEND_URL}/api/tower-talk", json=tower_talk_request) as resp:
                response_time = time.time() - start_time
                data = await resp.json()
                
                if resp.status == 200 and data.get('response'):
                    results.add_result("Tower Talk Regression", True,
                                     f"Response: '{data.get('response')[:100]}...'",
                                     response_time=response_time)
                else:
                    results.add_result("Tower Talk Regression", False,
                                     f"Status: {resp.status}, Response: {data}",
                                     response_time=response_time)
                    
        except Exception as e:
            results.add_result("Tower Talk Regression", False, f"Exception: {e}")
    
    return results

async def test_customer_list_regression() -> TestResults:
    """Test 7: Customer List Regression"""
    results = TestResults()
    
    async with aiohttp.ClientSession() as session:
        
        try:
            start_time = time.time()
            async with session.get(f"{BACKEND_URL}/api/customers/list?limit=5") as resp:
                response_time = time.time() - start_time
                data = await resp.json()
                
                if (resp.status == 200 and 
                    isinstance(data.get('customers'), list)):
                    
                    results.add_result("Customer List Regression", True,
                                     f"Retrieved {len(data.get('customers', []))} customers",
                                     response_time=response_time)
                else:
                    results.add_result("Customer List Regression", False,
                                     f"Status: {resp.status}, Response: {data}",
                                     response_time=response_time)
                    
        except Exception as e:
            results.add_result("Customer List Regression", False, f"Exception: {e}")
    
    return results

async def main():
    print("🎯 PTT VOICE TRANSLATION PIPELINE BACKEND TEST SUITE")
    print("=" * 70)
    print(f"Backend URL: {BACKEND_URL}")
    print()
    print("TESTING CRITICAL VOICE TRANSLATION BUG FIXES:")
    print("1. UserMessage(text=) parameter fix")
    print("2. LlmChat .with_model() method fix") 
    print("3. GPT-4o upgrade with automotive context")
    print()
    
    # Execute all test suites
    test_suites = [
        ("Health Check", test_health_check),
        ("Voice Translation - All 8 Paths", test_voice_translation_all_paths),
        ("Voice Translation Edge Cases", test_voice_translation_edge_cases),
        ("TTS - All 4 Languages", test_tts_all_languages),
        ("Text Translation", test_text_translation),
        ("Tower Talk Regression", test_tower_talk_regression),
        ("Customer List Regression", test_customer_list_regression)
    ]
    
    all_results = TestResults()
    suite_summaries = []
    
    for suite_name, test_function in test_suites:
        print(f"🔍 Testing: {suite_name}")
        suite_results = await test_function()
        
        # Aggregate results
        all_results.passed += suite_results.passed
        all_results.failed += suite_results.failed
        all_results.results.extend(suite_results.results)
        
        suite_summaries.append(f"  {suite_name}: {suite_results.passed}/{suite_results.passed + suite_results.failed}")
        print()
    
    # Final comprehensive summary
    print("=" * 70)
    all_results.summary()
    print()
    
    print("📊 DETAILED BREAKDOWN:")
    for summary in suite_summaries:
        print(summary)
    print()
    
    # Critical endpoints status
    voice_translate_tests = [r for r in all_results.results if 'Voice Translation:' in r['test']]
    voice_translate_passed = sum(1 for r in voice_translate_tests if r['passed'])
    
    print("🎯 CRITICAL VOICE TRANSLATION PIPELINE STATUS:")
    print(f"  Voice Translation Endpoints: {voice_translate_passed}/{len(voice_translate_tests)} working")
    
    if voice_translate_passed == len(voice_translate_tests) and voice_translate_passed > 0:
        print("✅ VOICE TRANSLATION PIPELINE: ALL FIXES VERIFIED WORKING")
    elif voice_translate_passed > 0:
        print(f"⚠️  VOICE TRANSLATION PIPELINE: {len(voice_translate_tests) - voice_translate_passed} issues remain")
    else:
        print("❌ VOICE TRANSLATION PIPELINE: CRITICAL ISSUES DETECTED")
    
    print()
    
    # Overall quality gate
    total_tests = all_results.passed + all_results.failed
    pass_rate = (all_results.passed / total_tests) * 100 if total_tests > 0 else 0
    
    if pass_rate >= 90:
        print(f"🎉 QUALITY GATE: PASSED ({pass_rate:.1f}% ≥ 90%)")
        print("PTT Voice Translation Pipeline is ready for production!")
    elif pass_rate >= 75:
        print(f"⚠️  QUALITY GATE: CONDITIONAL PASS ({pass_rate:.1f}% ≥ 75%)")
        print("Core functionality working, minor issues need attention.")
    else:
        print(f"❌ QUALITY GATE: FAILED ({pass_rate:.1f}% < 75%)")
        print("Significant issues detected, requires immediate attention.")
    
    return all_results

if __name__ == "__main__":
    asyncio.run(main())