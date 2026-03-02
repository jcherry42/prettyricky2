#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Supercharg'd Automotive Sales App
Testing critical bug fixes and full regression as requested in review.

Test Focus Areas from Review Request:
1. /api/voice-translate — UserMessage fix, LlmChat.with_model fix, automotive context 
2. /api/import/email — LlmChat constructor + send_message_async fix
3. /api/vision/extract-customer — route fix (was /api/api/vision/extract-customer)
4. /api/tts — all languages (EN/ES/FR/KO)
5. /api/translate — text translation
6. Core regression endpoints
"""

import asyncio
import aiohttp
import json
import base64
import tempfile
import os
from pathlib import Path
from typing import Dict, Any, Optional
import time

# Backend URL - using localhost as specified in review
BACKEND_URL = "http://localhost:8001"

class BackendTester:
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.test_results = []
        self.total_tests = 0
        self.passed_tests = 0
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    def log_test(self, test_name: str, status: str, response_time: float = 0, details: str = ""):
        """Log test result"""
        self.total_tests += 1
        if status == "PASS":
            self.passed_tests += 1
            
        result = {
            "test": test_name,
            "status": status,
            "response_time_ms": round(response_time * 1000, 2),
            "details": details
        }
        self.test_results.append(result)
        
        # Print result
        status_emoji = "✅" if status == "PASS" else "❌"
        print(f"{status_emoji} {test_name} ({response_time*1000:.0f}ms) - {details}")
        
    async def test_endpoint(self, method: str, endpoint: str, test_name: str, 
                          data: Any = None, files: Any = None, 
                          expected_status: int = 200, expected_fields: list = None) -> Dict[str, Any]:
        """Generic test endpoint helper"""
        url = f"{BACKEND_URL}{endpoint}"
        start_time = time.time()
        
        try:
            if method.upper() == "GET":
                async with self.session.get(url) as response:
                    response_time = time.time() - start_time
                    response_data = await response.json() if response.content_type == 'application/json' else await response.text()
                    
            elif method.upper() == "POST":
                if files:
                    # For multipart form data
                    form_data = aiohttp.FormData()
                    if data:
                        for key, value in data.items():
                            form_data.add_field(key, value)
                    for key, file_info in files.items():
                        form_data.add_field(key, file_info['data'], 
                                          filename=file_info['filename'],
                                          content_type=file_info['content_type'])
                    
                    async with self.session.post(url, data=form_data) as response:
                        response_time = time.time() - start_time
                        response_data = await response.json() if response.content_type == 'application/json' else await response.text()
                        
                elif isinstance(data, dict) and not any(isinstance(v, str) and v.startswith('form:') for v in data.values()):
                    # JSON data
                    async with self.session.post(url, json=data) as response:
                        response_time = time.time() - start_time
                        response_data = await response.json() if response.content_type == 'application/json' else await response.text()
                        
                else:
                    # Form data
                    form_data = aiohttp.FormData()
                    if data:
                        for key, value in data.items():
                            if isinstance(value, str) and value.startswith('form:'):
                                form_data.add_field(key, value[5:])  # Remove 'form:' prefix
                            else:
                                form_data.add_field(key, str(value))
                    
                    async with self.session.post(url, data=form_data) as response:
                        response_time = time.time() - start_time
                        response_data = await response.json() if response.content_type == 'application/json' else await response.text()
            
            # Validate response
            if isinstance(expected_status, list):
                if response.status not in expected_status:
                    self.log_test(test_name, "FAIL", response_time, 
                                f"Status {response.status}, expected one of {expected_status}")
                    return {"error": f"Wrong status code: {response.status}"}
            else:
                if response.status != expected_status:
                    self.log_test(test_name, "FAIL", response_time, 
                                f"Status {response.status}, expected {expected_status}")
                    return {"error": f"Wrong status code: {response.status}"}
                
            if expected_fields and isinstance(response_data, dict):
                missing_fields = [field for field in expected_fields if field not in response_data]
                if missing_fields:
                    self.log_test(test_name, "FAIL", response_time, 
                                f"Missing fields: {missing_fields}")
                    return {"error": f"Missing fields: {missing_fields}"}
                    
            self.log_test(test_name, "PASS", response_time, "OK")
            return response_data
            
        except Exception as e:
            response_time = time.time() - start_time
            self.log_test(test_name, "FAIL", response_time, str(e))
            return {"error": str(e)}
    
    def create_test_audio(self, format: str = "wav") -> bytes:
        """Create minimal test audio file"""
        if format == "wav":
            # Minimal WAV file header (44 bytes) + 1 second of silence
            header = b'RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00'
            silence = b'\x00' * 8000  # 1 second at 8kHz mono
            return header + silence
        return b"fake audio data"
    
    async def run_comprehensive_tests(self):
        """Run all comprehensive backend tests as per review request"""
        
        print("🎯 STARTING COMPREHENSIVE BACKEND REGRESSION TESTING")
        print("=" * 70)
        
        # A. VOICE TRANSLATION TESTS (Critical bug fixes)
        print("\n🔊 VOICE TRANSLATION TESTS (Critical Bug Fixes)")
        print("-" * 50)
        
        await self.test_voice_translate_en_to_es()
        await self.test_voice_translate_es_to_en()
        await self.test_voice_translate_en_to_fr()
        await self.test_voice_translate_fr_to_en()
        await self.test_voice_translate_en_to_ko()
        await self.test_voice_translate_ko_to_en()
        await self.test_voice_translate_edge_cases()
        
        # B. EMAIL IMPORT TESTS (Newly fixed)
        print("\n📧 EMAIL IMPORT TESTS (LlmChat Constructor Fix)")
        print("-" * 50)
        
        await self.test_email_import()
        
        # C. VISION EXTRACT TESTS (Route fix)
        print("\n👁️ VISION EXTRACT TESTS (Route Fix)")
        print("-" * 50)
        
        await self.test_vision_extract_customer()
        
        # D. TTS TESTS (All languages)
        print("\n🔊 TTS TESTS (All Languages)")
        print("-" * 50)
        
        await self.test_tts_english()
        await self.test_tts_spanish()
        await self.test_tts_french()
        await self.test_tts_korean()
        
        # E. TEXT TRANSLATION TESTS
        print("\n🌐 TEXT TRANSLATION TESTS")
        print("-" * 50)
        
        await self.test_text_translation()
        
        # F. CORE REGRESSION TESTS
        print("\n🏥 CORE REGRESSION TESTS")
        print("-" * 50)
        
        await self.test_health_check()
        await self.test_customers_list()
        await self.test_tower_talk()
        await self.test_import_file()
        
        # Print final summary
        self.print_summary()
    
    # VOICE TRANSLATION TESTS
    async def test_voice_translate_en_to_es(self):
        """Test EN→ES voice translation with automotive context"""
        audio_data = self.create_test_audio()
        files = {
            'audio': {
                'data': audio_data,
                'filename': 'test_audio.wav',
                'content_type': 'audio/wav'
            }
        }
        data = {
            'source_lang': 'en',
            'target_lang': 'es'
        }
        
        response = await self.test_endpoint(
            "POST", "/api/voice-translate", 
            "Voice Translate EN→ES", 
            data=data, files=files,
            expected_fields=['transcript', 'translated_text', 'source_lang', 'target_lang', 'success']
        )
        
    async def test_voice_translate_es_to_en(self):
        """Test ES→EN voice translation"""
        audio_data = self.create_test_audio()
        files = {
            'audio': {
                'data': audio_data,
                'filename': 'test_spanish.wav',
                'content_type': 'audio/wav'
            }
        }
        data = {
            'source_lang': 'es',
            'target_lang': 'en'
        }
        
        await self.test_endpoint(
            "POST", "/api/voice-translate", 
            "Voice Translate ES→EN", 
            data=data, files=files,
            expected_fields=['transcript', 'translated_text', 'source_lang', 'target_lang', 'success']
        )
        
    async def test_voice_translate_en_to_fr(self):
        """Test EN→FR voice translation"""
        audio_data = self.create_test_audio()
        files = {
            'audio': {
                'data': audio_data,
                'filename': 'test_english.wav',
                'content_type': 'audio/wav'
            }
        }
        data = {
            'source_lang': 'en',
            'target_lang': 'fr'
        }
        
        await self.test_endpoint(
            "POST", "/api/voice-translate", 
            "Voice Translate EN→FR", 
            data=data, files=files,
            expected_fields=['transcript', 'translated_text', 'source_lang', 'target_lang', 'success']
        )
    
    async def test_voice_translate_fr_to_en(self):
        """Test FR→EN voice translation"""
        audio_data = self.create_test_audio()
        files = {
            'audio': {
                'data': audio_data,
                'filename': 'test_french.wav',
                'content_type': 'audio/wav'
            }
        }
        data = {
            'source_lang': 'fr',
            'target_lang': 'en'
        }
        
        await self.test_endpoint(
            "POST", "/api/voice-translate", 
            "Voice Translate FR→EN", 
            data=data, files=files,
            expected_fields=['transcript', 'translated_text', 'source_lang', 'target_lang', 'success']
        )
    
    async def test_voice_translate_en_to_ko(self):
        """Test EN→KO voice translation"""
        audio_data = self.create_test_audio()
        files = {
            'audio': {
                'data': audio_data,
                'filename': 'test_english.wav',
                'content_type': 'audio/wav'
            }
        }
        data = {
            'source_lang': 'en',
            'target_lang': 'ko'
        }
        
        await self.test_endpoint(
            "POST", "/api/voice-translate", 
            "Voice Translate EN→KO", 
            data=data, files=files,
            expected_fields=['transcript', 'translated_text', 'source_lang', 'target_lang', 'success']
        )
    
    async def test_voice_translate_ko_to_en(self):
        """Test KO→EN voice translation"""
        audio_data = self.create_test_audio()
        files = {
            'audio': {
                'data': audio_data,
                'filename': 'test_korean.wav',
                'content_type': 'audio/wav'
            }
        }
        data = {
            'source_lang': 'ko',
            'target_lang': 'en'
        }
        
        await self.test_endpoint(
            "POST", "/api/voice-translate", 
            "Voice Translate KO→EN", 
            data=data, files=files,
            expected_fields=['transcript', 'translated_text', 'source_lang', 'target_lang', 'success']
        )
    
    async def test_voice_translate_edge_cases(self):
        """Test voice translation edge cases"""
        # Test 1: Empty audio
        files = {
            'audio': {
                'data': b'',
                'filename': 'empty.wav',
                'content_type': 'audio/wav'
            }
        }
        data = {'source_lang': 'en', 'target_lang': 'es'}
        
        await self.test_endpoint(
            "POST", "/api/voice-translate", 
            "Voice Translate Empty Audio→422", 
            data=data, files=files,
            expected_status=422
        )
        
        # Test 2: Same language (en→en)
        audio_data = self.create_test_audio()
        files = {
            'audio': {
                'data': audio_data,
                'filename': 'test.wav',
                'content_type': 'audio/wav'
            }
        }
        data = {'source_lang': 'en', 'target_lang': 'en'}
        
        response = await self.test_endpoint(
            "POST", "/api/voice-translate", 
            "Voice Translate Same Lang (en→en)", 
            data=data, files=files,
            expected_fields=['transcript', 'translated_text', 'success']
        )
        
        # Should have transcript == translated_text for same language
        if isinstance(response, dict) and 'transcript' in response and 'translated_text' in response:
            if response['transcript'] == response['translated_text']:
                print("   ✓ Same language: transcript == translated_text")
            else:
                print("   ⚠️ Same language: transcript != translated_text")
    
    # EMAIL IMPORT TESTS
    async def test_email_import(self):
        """Test email import with LlmChat constructor fix"""
        data = {
            'form:email_body': 'Hi, I\'m interested in a 2024 BMW X5. My name is John Smith, phone 555-123-4567, email john@test.com. Looking to trade in my 2020 Honda Civic.',
            'form:email_subject': 'Vehicle Inquiry',
            'form:email_from': 'john@test.com'
        }
        
        await self.test_endpoint(
            "POST", "/api/import/email",
            "Email Import with Customer Info",
            data=data,
            expected_status=200
        )
    
    # VISION EXTRACT TESTS
    async def test_vision_extract_customer(self):
        """Test vision extract customer (route was fixed from /api/api/ to /api/)"""
        data = {
            'image_data': 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
        }
        
        await self.test_endpoint(
            "POST", "/api/vision/extract-customer",
            "Vision Extract Customer (Route Fix)",
            data=data,
            expected_status=[200, 422]  # Accept both success and validation error
        )
    
    # TTS TESTS
    async def test_tts_english(self):
        """Test TTS English"""
        data = {
            'text': 'Test drive scheduled',
            'voice': 'auto',
            'language': 'en'
        }
        
        response = await self.test_endpoint(
            "POST", "/api/tts",
            "TTS English",
            data=data,
            expected_fields=['audio_base64', 'voice_used']
        )
        
        # Verify audio_base64 is not empty
        if isinstance(response, dict) and 'audio_base64' in response:
            if len(response['audio_base64']) > 1000:
                print("   ✓ Audio generated successfully")
            else:
                print("   ⚠️ Audio seems too short")
    
    async def test_tts_spanish(self):
        """Test TTS Spanish"""
        data = {
            'text': 'Prueba de manejo programada',
            'voice': 'auto',
            'language': 'es'
        }
        
        await self.test_endpoint(
            "POST", "/api/tts",
            "TTS Spanish",
            data=data,
            expected_fields=['audio_base64', 'voice_used']
        )
    
    async def test_tts_french(self):
        """Test TTS French"""
        data = {
            'text': 'Essai routier programmé',
            'voice': 'auto',
            'language': 'fr'
        }
        
        await self.test_endpoint(
            "POST", "/api/tts",
            "TTS French",
            data=data,
            expected_fields=['audio_base64', 'voice_used']
        )
    
    async def test_tts_korean(self):
        """Test TTS Korean"""
        data = {
            'text': '시승 예약이 완료되었습니다',
            'voice': 'auto',
            'language': 'ko'
        }
        
        await self.test_endpoint(
            "POST", "/api/tts",
            "TTS Korean",
            data=data,
            expected_fields=['audio_base64', 'voice_used']
        )
    
    # TEXT TRANSLATION TESTS
    async def test_text_translation(self):
        """Test text translation endpoints"""
        # Test EN→ES
        data = {
            'text': 'I\'d like to discuss financing options',
            'source_lang': 'en',
            'target_lang': 'es'
        }
        
        response = await self.test_endpoint(
            "POST", "/api/translate",
            "Text Translation EN→ES",
            data=data,
            expected_fields=['translated_text']
        )
        
        # Test EN→KO
        data = {
            'text': 'I\'d like to discuss financing options',
            'source_lang': 'en',
            'target_lang': 'ko'
        }
        
        await self.test_endpoint(
            "POST", "/api/translate",
            "Text Translation EN→KO",
            data=data,
            expected_fields=['translated_text']
        )
    
    # CORE REGRESSION TESTS
    async def test_health_check(self):
        """Test health check endpoint"""
        response = await self.test_endpoint(
            "GET", "/api/health",
            "Health Check",
            expected_fields=['status']
        )
        
        if isinstance(response, dict) and response.get('status') == 'healthy':
            print("   ✓ Backend is healthy")
        else:
            print("   ⚠️ Backend health status unclear")
    
    async def test_customers_list(self):
        """Test customers list endpoint"""
        response = await self.test_endpoint(
            "GET", "/api/customers/list?limit=3",
            "Customers List",
            expected_fields=['customers', 'total']
        )
        
        if isinstance(response, dict):
            if 'customers' in response and isinstance(response['customers'], list):
                print(f"   ✓ Found {len(response['customers'])} customers")
            if 'total' in response:
                print(f"   ✓ Total customers: {response['total']}")
    
    async def test_tower_talk(self):
        """Test Tower Talk AI endpoint"""
        data = {
            'situation': 'Customer asking about warranty',
            'inquiryType': 'warranty',
            'context': {
                'customerName': 'Maria',
                'vehicle': '2024 Toyota Camry'
            }
        }
        
        response = await self.test_endpoint(
            "POST", "/api/tower-talk",
            "Tower Talk AI",
            data=data,
            expected_fields=['response']
        )
        
        if isinstance(response, dict) and 'response' in response:
            response_length = len(response['response'])
            print(f"   ✓ AI response generated ({response_length} chars)")
    
    async def test_import_file(self):
        """Test import file endpoint exists (can return 422 for missing file)"""
        # Just verify endpoint exists - expect 422 for missing file
        await self.test_endpoint(
            "POST", "/api/import/file",
            "Import File Endpoint Exists",
            expected_status=422
        )
    
    def print_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 70)
        print("🎯 COMPREHENSIVE BACKEND REGRESSION TEST SUMMARY")
        print("=" * 70)
        
        # Overall stats
        pass_rate = (self.passed_tests / self.total_tests) * 100 if self.total_tests > 0 else 0
        print(f"\n📊 OVERALL RESULTS: {self.passed_tests}/{self.total_tests} tests passed ({pass_rate:.1f}%)")
        
        if pass_rate >= 90:
            print("🎉 EXCELLENT - Production Ready!")
        elif pass_rate >= 75:
            print("✅ GOOD - Minor issues to address")
        else:
            print("⚠️ NEEDS ATTENTION - Multiple issues found")
        
        # Group results by category
        categories = {}
        for result in self.test_results:
            category = result['test'].split(' ')[0:2]  # First two words as category
            category_name = ' '.join(category)
            
            if category_name not in categories:
                categories[category_name] = {'pass': 0, 'fail': 0, 'total': 0}
            
            categories[category_name]['total'] += 1
            if result['status'] == 'PASS':
                categories[category_name]['pass'] += 1
            else:
                categories[category_name]['fail'] += 1
        
        # Print category breakdown
        print(f"\n📋 RESULTS BY CATEGORY:")
        for category, stats in categories.items():
            category_pass_rate = (stats['pass'] / stats['total']) * 100
            status_emoji = "✅" if category_pass_rate == 100 else "⚠️" if category_pass_rate >= 75 else "❌"
            print(f"   {status_emoji} {category}: {stats['pass']}/{stats['total']} ({category_pass_rate:.0f}%)")
        
        # Show failures
        failures = [r for r in self.test_results if r['status'] == 'FAIL']
        if failures:
            print(f"\n❌ FAILURES TO ADDRESS:")
            for failure in failures:
                print(f"   • {failure['test']}: {failure['details']}")
        else:
            print(f"\n✅ NO FAILURES - All tests passed!")
        
        # Performance summary
        avg_response_time = sum(r['response_time_ms'] for r in self.test_results) / len(self.test_results)
        print(f"\n⏱️ PERFORMANCE: Average response time {avg_response_time:.0f}ms")
        
        # Critical fixes verification
        print(f"\n🔧 CRITICAL FIXES VERIFICATION:")
        voice_tests = [r for r in self.test_results if 'Voice Translate' in r['test']]
        voice_pass_rate = (len([r for r in voice_tests if r['status'] == 'PASS']) / len(voice_tests)) * 100 if voice_tests else 0
        print(f"   • Voice Translation Fixes: {voice_pass_rate:.0f}% pass rate")
        
        email_tests = [r for r in self.test_results if 'Email Import' in r['test']]
        email_pass_rate = (len([r for r in email_tests if r['status'] == 'PASS']) / len(email_tests)) * 100 if email_tests else 0
        print(f"   • Email Import Fix: {email_pass_rate:.0f}% pass rate")
        
        vision_tests = [r for r in self.test_results if 'Vision Extract' in r['test']]
        vision_pass_rate = (len([r for r in vision_tests if r['status'] == 'PASS']) / len(vision_tests)) * 100 if vision_tests else 0
        print(f"   • Vision Extract Route Fix: {vision_pass_rate:.0f}% pass rate")
        
        print("\n" + "=" * 70)

async def main():
    """Main test execution"""
    async with BackendTester() as tester:
        await tester.run_comprehensive_tests()

if __name__ == "__main__":
    asyncio.run(main())