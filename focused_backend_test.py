#!/usr/bin/env python3
"""
Focused Backend Testing for test_result.md update

Testing critical endpoints to update the test results based on review request.
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime


class FocusedBackendTester:
    def __init__(self):
        self.base_url = "http://localhost:8001/api"
        self.session = None
        self.results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name: str, success: bool, details: str, response_time: float = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_time": response_time
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        time_info = f" ({response_time:.2f}s)" if response_time else ""
        print(f"{status}: {test_name}{time_info}")
        print(f"   {details}")
        print()

    async def run_critical_tests(self):
        """Run critical backend tests"""
        print("🎯 CRITICAL BACKEND TESTS FOR SUPERCHARG'D")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        print()

        # 1. Health Check
        await self.test_health()
        
        # 2. Tower Talk (sample test)
        await self.test_tower_talk_sample()
        
        # 3. Translation (sample test)
        await self.test_translation_sample()
        
        # 4. TTS (sample test)
        await self.test_tts_sample()
        
        # 5. Customer List
        await self.test_customer_list()
        
        # 6. VIN Decode (working VIN)
        await self.test_vin_decode()
        
        # 7. Voice Translate validation
        await self.test_voice_translate_validation()

        # Generate summary
        await self.generate_summary()

    async def test_health(self):
        """Test health endpoint"""
        try:
            start_time = time.time()
            async with self.session.get(f"{self.base_url}/health") as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    success = data.get('status') == 'healthy'
                    self.log_result(
                        "Health Check",
                        success,
                        f"Status: {data.get('status')} - Response in {response_time:.3f}s",
                        response_time
                    )
                else:
                    self.log_result(
                        "Health Check",
                        False,
                        f"HTTP {response.status} - Response in {response_time:.3f}s",
                        response_time
                    )
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")

    async def test_tower_talk_sample(self):
        """Test Tower Talk with sample request"""
        try:
            start_time = time.time()
            
            payload = {
                "situation": "Customer asking about financing options for 2024 BMW X5",
                "inquiryType": "financing",
                "context": {
                    "customerName": "Sarah",
                    "vehicle": "2024 BMW X5",
                    "salespersonName": "Mike"
                }
            }
            
            async with self.session.post(f"{self.base_url}/tower-talk", json=payload) as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    response_text = data.get("response", "")
                    
                    # Basic quality checks
                    sentences = [s.strip() for s in response_text.split('.') if s.strip()]
                    has_emojis = any(ord(char) > 127 and ord(char) not in range(0x0080, 0x00FF) for char in response_text)
                    proper_length = 2 <= len(sentences) <= 3
                    
                    # Overall assessment
                    if proper_length and not has_emojis and response_time < 8.0:
                        success = True
                        issues = "None"
                    else:
                        success = False  # Allow minor issues but report them
                        issues = []
                        if not proper_length:
                            issues.append(f"Length: {len(sentences)} sentences")
                        if has_emojis:
                            issues.append("Has emojis")
                        if response_time >= 8.0:
                            issues.append("Slow response")
                        issues = ", ".join(issues) if issues else "None"
                    
                    self.log_result(
                        "Tower Talk (financing inquiry)",
                        success,
                        f"Response: {len(sentences)} sentences, Issues: {issues}, Time: {response_time:.2f}s",
                        response_time
                    )
                else:
                    self.log_result(
                        "Tower Talk (financing inquiry)",
                        False,
                        f"HTTP {response.status}",
                        response_time
                    )
        except Exception as e:
            self.log_result("Tower Talk (financing inquiry)", False, f"Exception: {str(e)}")

    async def test_translation_sample(self):
        """Test translation with sample"""
        try:
            start_time = time.time()
            
            payload = {
                "text": "The 2024 BMW X5 is available for test drive this weekend",
                "source_lang": "en",
                "target_lang": "es"
            }
            
            async with self.session.post(f"{self.base_url}/translate", json=payload) as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    translated = data.get("translated_text", "")
                    success = len(translated) > 0 and response_time < 8.0
                    
                    self.log_result(
                        "Translation (EN→ES BMW test drive)",
                        success,
                        f"Translated '{payload['text'][:30]}...' to '{translated[:30]}...' in {response_time:.2f}s",
                        response_time
                    )
                else:
                    self.log_result(
                        "Translation (EN→ES BMW test drive)",
                        False,
                        f"HTTP {response.status}",
                        response_time
                    )
        except Exception as e:
            self.log_result("Translation (EN→ES BMW test drive)", False, f"Exception: {str(e)}")

    async def test_tts_sample(self):
        """Test TTS with sample"""
        try:
            start_time = time.time()
            
            payload = {
                "text": "Hello, the vehicle is ready for pickup",
                "language": "en",
                "voice": "auto"
            }
            
            async with self.session.post(f"{self.base_url}/tts", json=payload) as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    audio_base64 = data.get("audio_base64", "")
                    success = len(audio_base64) > 0 and response_time < 8.0
                    
                    self.log_result(
                        "TTS (English audio generation)",
                        success,
                        f"Generated {len(audio_base64)} chars of audio in {response_time:.2f}s",
                        response_time
                    )
                else:
                    self.log_result(
                        "TTS (English audio generation)",
                        False,
                        f"HTTP {response.status}",
                        response_time
                    )
        except Exception as e:
            self.log_result("TTS (English audio generation)", False, f"Exception: {str(e)}")

    async def test_customer_list(self):
        """Test customer list"""
        try:
            start_time = time.time()
            async with self.session.get(f"{self.base_url}/customers/list?limit=5") as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    customers = data.get("customers", [])
                    total = data.get("total", 0)
                    
                    self.log_result(
                        "Customer List",
                        True,
                        f"Retrieved {len(customers)} customers, Total: {total}, Time: {response_time:.2f}s",
                        response_time
                    )
                else:
                    self.log_result(
                        "Customer List",
                        False,
                        f"HTTP {response.status}",
                        response_time
                    )
        except Exception as e:
            self.log_result("Customer List", False, f"Exception: {str(e)}")

    async def test_vin_decode(self):
        """Test VIN decode with working VIN"""
        try:
            start_time = time.time()
            vin = "JM3KKEHA3T1355103"  # Known working VIN
            async with self.session.get(f"{self.base_url}/vin/decode/{vin}") as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    make = data.get("make", "")
                    model = data.get("model", "")
                    year = data.get("year", "")
                    
                    self.log_result(
                        "VIN Decode",
                        True,
                        f"VIN {vin} decoded to {year} {make} {model} in {response_time:.2f}s",
                        response_time
                    )
                else:
                    self.log_result(
                        "VIN Decode",
                        False,
                        f"HTTP {response.status}",
                        response_time
                    )
        except Exception as e:
            self.log_result("VIN Decode", False, f"Exception: {str(e)}")

    async def test_voice_translate_validation(self):
        """Test voice translate validation"""
        try:
            start_time = time.time()
            
            # Test invalid format
            fake_audio = b"This is not audio"
            data = aiohttp.FormData()
            data.add_field('audio', fake_audio, filename='test.txt', content_type='text/plain')
            data.add_field('source_lang', 'en')
            data.add_field('target_lang', 'es')
            
            async with self.session.post(f"{self.base_url}/voice-translate", data=data) as response:
                response_time = time.time() - start_time
                
                # Should return 422 for invalid format
                if response.status == 422:
                    self.log_result(
                        "Voice Translate Validation",
                        True,
                        f"Correctly rejected invalid format with HTTP 422 in {response_time:.2f}s",
                        response_time
                    )
                else:
                    self.log_result(
                        "Voice Translate Validation",
                        False,
                        f"Expected HTTP 422 but got {response.status}",
                        response_time
                    )
        except Exception as e:
            self.log_result("Voice Translate Validation", False, f"Exception: {str(e)}")

    async def generate_summary(self):
        """Generate test summary"""
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total = len(self.results)
        passed = sum(1 for r in self.results if r["success"])
        failed = total - passed
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        print()
        
        # Performance check
        response_times = [r.get("response_time", 0) for r in self.results if r.get("response_time")]
        if response_times:
            avg_time = sum(response_times) / len(response_times)
            max_time = max(response_times)
            print(f"⏱️ Performance:")
            print(f"   Average Response: {avg_time:.2f}s")
            print(f"   Maximum Response: {max_time:.2f}s")
            print(f"   All under 8s: {'✅ YES' if max_time < 8.0 else '❌ NO'}")
            print()
        
        # Critical failures
        if failed > 0:
            print("❌ Failed Tests:")
            for result in self.results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['details']}")
            print()
        
        return passed, failed, total


async def main():
    async with FocusedBackendTester() as tester:
        await tester.run_critical_tests()


if __name__ == "__main__":
    asyncio.run(main())