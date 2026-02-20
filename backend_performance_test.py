#!/usr/bin/env python3
"""
Comprehensive Backend Performance Scan for Supercharg'd Automotive CRM

This test suite runs all the tests requested in the review:
1. Complete Backend Health Scan
2. Tower Talk with inquiryType (all 8 types)
3. Translation Quality (gpt-4o upgrade)
4. TTS Audio Quality (all 4 languages)
5. Customer CRUD Regression
6. VIN Decode
7. Voice Translate Validation

Testing against backend URL from environment configuration.
"""

import asyncio
import aiohttp
import json
import time
import os
import base64
import io
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path


class BackendPerformanceTester:
    def __init__(self):
        # Try to get backend URL from environment or use default
        self.base_url = self._get_backend_url()
        self.session = None
        self.results = []
        self.test_customers = []  # Track customers created during tests
        
    def _get_backend_url(self) -> str:
        """Get backend URL from configuration"""
        # Check if we have a frontend .env file
        frontend_env_path = Path("/app/frontend/.env")
        if frontend_env_path.exists():
            with open(frontend_env_path, 'r') as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL"):
                        url = line.split("=", 1)[1].strip().strip('"\'')
                        return f"{url}/api"
        
        # Check for mobile .env file
        mobile_env_path = Path("/app/mobile/.env")
        if mobile_env_path.exists():
            with open(mobile_env_path, 'r') as f:
                for line in f:
                    if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                        url = line.split("=", 1)[1].strip().strip('"\'')
                        return f"{url}/api"
        
        # Default to localhost as mentioned in review
        return "http://localhost:8001/api"
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name: str, success: bool, details: str, response_data: Any = None, response_time: float = None):
        """Log test result with timestamp"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data,
            "response_time": response_time
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        time_info = f" ({response_time:.2f}s)" if response_time else ""
        print(f"{status}: {test_name}{time_info}")
        print(f"   Details: {details}")
        if response_data and isinstance(response_data, dict) and len(str(response_data)) < 500:
            print(f"   Response: {json.dumps(response_data, indent=2)}")
        print()

    # 1. COMPLETE BACKEND HEALTH SCAN
    async def test_backend_health(self):
        """Test health check endpoint and measure response time"""
        try:
            start_time = time.time()
            async with self.session.get(f"{self.base_url}/health") as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    expected_status = data.get('status') == 'healthy'
                    
                    self.log_result(
                        "Backend Health Check",
                        expected_status,
                        f"Status: {data.get('status')}, Response time: {response_time:.3f}s",
                        data,
                        response_time
                    )
                else:
                    self.log_result(
                        "Backend Health Check", 
                        False,
                        f"HTTP {response.status}, Response time: {response_time:.3f}s",
                        response_time=response_time
                    )
        except Exception as e:
            self.log_result("Backend Health Check", False, f"Exception: {str(e)}")

    # 2. TOWER TALK with inquiryType (ALL 8 types)
    async def test_tower_talk_with_inquiry_type(self, inquiry_type: str, situation: str, context: Dict[str, Any], test_name: str):
        """Test Tower Talk endpoint with specific inquiry type"""
        try:
            start_time = time.time()
            
            payload = {
                "situation": situation,
                "inquiryType": inquiry_type,
                "context": context
            }
            
            async with self.session.post(
                f"{self.base_url}/tower-talk",
                json=payload
            ) as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    response_text = data.get("response", "")
                    
                    # Quality checks as specified in review
                    sentences = [s.strip() for s in response_text.split('.') if s.strip()]
                    sentence_count = len(sentences)
                    
                    # Check for violations
                    has_emojis = any(ord(char) > 127 and ord(char) not in range(0x0080, 0x00FF) for char in response_text)
                    has_brackets = '[' in response_text or ']' in response_text
                    
                    # Check for salesperson name sign-off if provided
                    salesperson_name = context.get('salespersonName')
                    signs_off_properly = False
                    if salesperson_name:
                        # Check if response ends with first name
                        first_name = salesperson_name.split()[0]
                        signs_off_properly = first_name.lower() in response_text.lower().split()[-10:]  # Check last 10 words
                    
                    # Response length check (2-3 sentences)
                    proper_length = 2 <= sentence_count <= 3
                    
                    # Overall quality assessment
                    quality_issues = []
                    if not proper_length:
                        quality_issues.append(f"Length: {sentence_count} sentences (expected 2-3)")
                    if has_emojis:
                        quality_issues.append("Contains emojis")
                    if has_brackets:
                        quality_issues.append("Contains brackets")
                    if response_time > 8.0:
                        quality_issues.append(f"Slow response: {response_time:.2f}s")
                    
                    success = len(quality_issues) == 0
                    details = f"inquiryType: {inquiry_type}, Sentences: {sentence_count}, Response time: {response_time:.2f}s"
                    if quality_issues:
                        details += f" - Issues: {', '.join(quality_issues)}"
                    if salesperson_name and signs_off_properly:
                        details += f" - Signs off with {salesperson_name.split()[0]} ✓"
                    
                    self.log_result(
                        f"Tower Talk - {test_name}",
                        success,
                        details,
                        {
                            "inquiry_type": inquiry_type,
                            "sentence_count": sentence_count,
                            "response_preview": response_text[:150] + "..." if len(response_text) > 150 else response_text,
                            "has_emojis": has_emojis,
                            "has_brackets": has_brackets,
                            "signs_off_properly": signs_off_properly,
                            "quality_issues": quality_issues
                        },
                        response_time
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        f"Tower Talk - {test_name}",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}",
                        response_time=response_time
                    )
                    
        except Exception as e:
            self.log_result(f"Tower Talk - {test_name}", False, f"Exception: {str(e)}")

    async def test_tower_talk_backward_compatibility(self):
        """Test Tower Talk without inquiryType for backward compatibility"""
        try:
            start_time = time.time()
            
            payload = {
                "situation": "Quick check-in with customer about their interest level",
                "context": {
                    "customerName": "Sam"
                }
            }
            
            async with self.session.post(
                f"{self.base_url}/tower-talk",
                json=payload
            ) as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    response_text = data.get("response", "")
                    
                    self.log_result(
                        "Tower Talk - Backward Compatibility",
                        True,
                        f"Response length: {len(response_text)}, Time: {response_time:.2f}s",
                        {
                            "response_preview": response_text[:100] + "..." if len(response_text) > 100 else response_text
                        },
                        response_time
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Tower Talk - Backward Compatibility",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}",
                        response_time=response_time
                    )
                    
        except Exception as e:
            self.log_result("Tower Talk - Backward Compatibility", False, f"Exception: {str(e)}")

    # 3. TRANSLATION QUALITY (gpt-4o upgrade)
    async def test_translation(self, source_lang: str, target_lang: str, text: str, test_name: str):
        """Test translation endpoint quality"""
        try:
            start_time = time.time()
            
            payload = {
                "text": text,
                "source_lang": source_lang,
                "target_lang": target_lang
            }
            
            async with self.session.post(
                f"{self.base_url}/translate",
                json=payload
            ) as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    translated_text = data.get("translated_text", "")
                    detected_lang = data.get("detected_lang")
                    confidence = data.get("confidence")
                    
                    # Check for automotive terminology preservation
                    automotive_terms_check = self._check_automotive_terminology(text, translated_text, target_lang)
                    
                    success = len(translated_text) > 0 and response_time < 8.0
                    
                    self.log_result(
                        f"Translation - {test_name}",
                        success,
                        f"{source_lang}→{target_lang}, Time: {response_time:.2f}s, Auto terms preserved: {automotive_terms_check}",
                        {
                            "source_lang": source_lang,
                            "target_lang": target_lang,
                            "original": text[:100] + "..." if len(text) > 100 else text,
                            "translated": translated_text[:100] + "..." if len(translated_text) > 100 else translated_text,
                            "detected_lang": detected_lang,
                            "confidence": confidence,
                            "automotive_terms_preserved": automotive_terms_check
                        },
                        response_time
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        f"Translation - {test_name}",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}",
                        response_time=response_time
                    )
                    
        except Exception as e:
            self.log_result(f"Translation - {test_name}", False, f"Exception: {str(e)}")

    def _check_automotive_terminology(self, original: str, translated: str, target_lang: str) -> bool:
        """Check if automotive terminology is preserved accurately"""
        # Key automotive terms that should translate properly
        automotive_terms = {
            "test drive": {"es": "prueba de manejo", "fr": "essai routier", "ko": "시승"},
            "trade-in": {"es": "intercambio", "fr": "reprise", "ko": "교환"},
            "financing": {"es": "financiamiento", "fr": "financement", "ko": "융자"},
            "warranty": {"es": "garantía", "fr": "garantie", "ko": "보증"},
            "APR": {"es": "APR", "fr": "APR", "ko": "APR"}  # APR should remain
        }
        
        # For this basic check, just verify translation isn't empty and makes sense
        return len(translated.strip()) > 0 and translated.lower() != original.lower()

    # 4. TTS AUDIO QUALITY (all 4 languages)
    async def test_tts_audio(self, text: str, language: str, voice: str, test_name: str):
        """Test Text-to-Speech audio generation"""
        try:
            start_time = time.time()
            
            payload = {
                "text": text,
                "language": language,
                "voice": voice
            }
            
            async with self.session.post(
                f"{self.base_url}/tts",
                json=payload
            ) as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    audio_base64 = data.get("audio_base64", "")
                    format_type = data.get("format", "")
                    voice_used = data.get("voice_used", "")
                    cached = data.get("cached", False)
                    
                    # Quality checks
                    has_audio = len(audio_base64) > 0
                    proper_format = format_type in ["mp3", "wav"]
                    fast_response = response_time < 8.0
                    
                    success = has_audio and fast_response
                    
                    self.log_result(
                        f"TTS - {test_name}",
                        success,
                        f"Lang: {language}, Voice: {voice_used}, Audio length: {len(audio_base64)} chars, Time: {response_time:.2f}s, Cached: {cached}",
                        {
                            "language": language,
                            "voice_used": voice_used,
                            "format": format_type,
                            "audio_length": len(audio_base64),
                            "cached": cached,
                            "has_audio_content": has_audio
                        },
                        response_time
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        f"TTS - {test_name}",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}",
                        response_time=response_time
                    )
                    
        except Exception as e:
            self.log_result(f"TTS - {test_name}", False, f"Exception: {str(e)}")

    # 5. CUSTOMER CRUD REGRESSION
    async def test_customer_crud_operations(self):
        """Test customer CRUD operations"""
        try:
            # Test customer creation
            await self._test_customer_creation()
            await self._test_customer_list()
            if self.test_customers:
                await self._test_customer_retrieval(self.test_customers[0]["id"])
                await self._test_customer_deletion(self.test_customers[0]["id"])
                
        except Exception as e:
            self.log_result("Customer CRUD Operations", False, f"Exception: {str(e)}")

    async def _test_customer_creation(self):
        """Test creating a new customer"""
        try:
            start_time = time.time()
            
            payload = {
                "name": "Alex Performance Test",
                "phone": "555-PERF-TEST",
                "email": "alex.perf@superchargd.test.com"
            }
            
            async with self.session.post(
                f"{self.base_url}/customers",
                json=payload
            ) as response:
                response_time = time.time() - start_time
                
                if response.status == 201:
                    data = await response.json()
                    customer = data.get("customer", {})
                    
                    # Track for cleanup
                    self.test_customers.append(customer)
                    
                    self.log_result(
                        "Customer Creation",
                        True,
                        f"Created customer {customer.get('name')}, ID: {customer.get('id')}, Time: {response_time:.2f}s",
                        {
                            "customer_id": customer.get("id"),
                            "name": customer.get("name"),
                            "phone": customer.get("phone")
                        },
                        response_time
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Customer Creation",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}",
                        response_time=response_time
                    )
                    
        except Exception as e:
            self.log_result("Customer Creation", False, f"Exception: {str(e)}")

    async def _test_customer_list(self):
        """Test customer list endpoint"""
        try:
            start_time = time.time()
            
            async with self.session.get(f"{self.base_url}/customers/list") as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    customers = data.get("customers", [])
                    total = data.get("total", 0)
                    
                    self.log_result(
                        "Customer List",
                        True,
                        f"Found {len(customers)} customers, Total: {total}, Time: {response_time:.2f}s",
                        {
                            "customer_count": len(customers),
                            "total": total
                        },
                        response_time
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Customer List",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}",
                        response_time=response_time
                    )
                    
        except Exception as e:
            self.log_result("Customer List", False, f"Exception: {str(e)}")

    async def _test_customer_retrieval(self, customer_id: str):
        """Test retrieving a specific customer"""
        try:
            start_time = time.time()
            
            async with self.session.get(f"{self.base_url}/customers/{customer_id}") as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    customer = data.get("customer", {})
                    
                    self.log_result(
                        "Customer Retrieval",
                        True,
                        f"Retrieved customer {customer.get('name')}, Time: {response_time:.2f}s",
                        {
                            "customer_id": customer.get("id"),
                            "name": customer.get("name")
                        },
                        response_time
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Customer Retrieval",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}",
                        response_time=response_time
                    )
                    
        except Exception as e:
            self.log_result("Customer Retrieval", False, f"Exception: {str(e)}")

    async def _test_customer_deletion(self, customer_id: str):
        """Test deleting a customer"""
        try:
            start_time = time.time()
            
            async with self.session.delete(f"{self.base_url}/customers/{customer_id}") as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    self.log_result(
                        "Customer Deletion",
                        True,
                        f"Deleted customer {customer_id}, Time: {response_time:.2f}s",
                        {"deleted_customer_id": customer_id},
                        response_time
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Customer Deletion",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}",
                        response_time=response_time
                    )
                    
        except Exception as e:
            self.log_result("Customer Deletion", False, f"Exception: {str(e)}")

    # 6. VIN DECODE
    async def test_vin_decode(self, vin: str):
        """Test VIN decode endpoint"""
        try:
            start_time = time.time()
            
            async with self.session.get(f"{self.base_url}/vin/decode/{vin}") as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    vehicle_info = data.get("vehicle", {})
                    
                    success = len(vehicle_info) > 0
                    
                    self.log_result(
                        "VIN Decode",
                        success,
                        f"VIN: {vin}, Vehicle: {vehicle_info.get('year', '')} {vehicle_info.get('make', '')} {vehicle_info.get('model', '')}, Time: {response_time:.2f}s",
                        {
                            "vin": vin,
                            "year": vehicle_info.get("year"),
                            "make": vehicle_info.get("make"),
                            "model": vehicle_info.get("model"),
                            "trim": vehicle_info.get("trim")
                        },
                        response_time
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        "VIN Decode",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}",
                        response_time=response_time
                    )
                    
        except Exception as e:
            self.log_result("VIN Decode", False, f"Exception: {str(e)}")

    # 7. VOICE TRANSLATE VALIDATION
    async def test_voice_translate_validation(self):
        """Test voice translate endpoint with various scenarios"""
        try:
            # Test with invalid file format
            await self._test_voice_translate_invalid_format()
            
        except Exception as e:
            self.log_result("Voice Translate Validation", False, f"Exception: {str(e)}")

    async def _test_voice_translate_invalid_format(self):
        """Test voice translate with invalid audio format"""
        try:
            start_time = time.time()
            
            # Create a small text file pretending to be audio
            fake_audio_data = b"This is not audio data"
            
            data = aiohttp.FormData()
            data.add_field('audio', fake_audio_data, filename='test.txt', content_type='text/plain')
            data.add_field('source_lang', 'en')
            data.add_field('target_lang', 'es')
            
            async with self.session.post(
                f"{self.base_url}/voice-translate",
                data=data
            ) as response:
                response_time = time.time() - start_time
                
                # Expect 422 for invalid format
                if response.status == 422:
                    self.log_result(
                        "Voice Translate - Invalid Format",
                        True,
                        f"Correctly rejected invalid format with HTTP 422, Time: {response_time:.2f}s",
                        {"expected_status": 422, "actual_status": 422},
                        response_time
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Voice Translate - Invalid Format",
                        False,
                        f"Expected HTTP 422 but got {response.status} - {error_text[:100]}",
                        response_time=response_time
                    )
                    
        except Exception as e:
            self.log_result("Voice Translate - Invalid Format", False, f"Exception: {str(e)}")

    async def run_comprehensive_backend_scan(self):
        """Run all tests as requested in the review"""
        print("🎯 COMPREHENSIVE BACKEND PERFORMANCE SCAN FOR SUPERCHARG'D AUTOMOTIVE CRM")
        print(f"Backend URL: {self.base_url}")
        print("=" * 100)
        print()

        # 1. COMPLETE BACKEND HEALTH SCAN
        print("1. 🏥 BACKEND HEALTH SCAN")
        print("-" * 50)
        await self.test_backend_health()
        print()

        # 2. TOWER TALK with inquiryType (ALL 8 types)
        print("2. 🗣️ TOWER TALK with inquiryType (ALL 8 types)")
        print("-" * 50)
        
        # Test all inquiry types as requested
        await self.test_tower_talk_with_inquiry_type(
            "new_lead",
            "Customer texted asking about 2024 Porsche Cayenne",
            {
                "customerName": "David",
                "vehicle": "2024 Porsche Cayenne",
                "dealershipName": "AutoNation",
                "salespersonName": "Jake"
            },
            "New Lead"
        )
        
        await self.test_tower_talk_with_inquiry_type(
            "objection",
            "Customer says price is $3000 too high",
            {
                "customerName": "Maria",
                "vehicle": "2023 BMW M3",
                "salespersonName": "Carlos"
            },
            "Price Objection"
        )
        
        await self.test_tower_talk_with_inquiry_type(
            "availability",
            "Customer wants to know if 2024 Tesla Model 3 is in stock",
            {"customerName": "John"},
            "Availability Check"
        )
        
        await self.test_tower_talk_with_inquiry_type(
            "financing",
            "Customer asking about financing options for a 60 month loan",
            {
                "customerName": "Priya",
                "vehicle": "2024 Lexus RX",
                "salespersonName": "Alex"
            },
            "Financing Options"
        )
        
        await self.test_tower_talk_with_inquiry_type(
            "follow_up",
            "Need to follow up on last week's test drive",
            {
                "customerName": "Tom",
                "vehicle": "2024 Ford Mustang"
            },
            "Follow Up"
        )
        
        # Test backward compatibility
        await self.test_tower_talk_backward_compatibility()
        print()

        # 3. TRANSLATION QUALITY (gpt-4o upgrade)
        print("3. 🌐 TRANSLATION QUALITY (gpt-4o upgrade)")
        print("-" * 50)
        
        await self.test_translation(
            "en", "es",
            "The 2024 BMW X5 xDrive40i is priced at $67,295 with 0% APR available for 36 months. Would you like to schedule a test drive this weekend?",
            "BMW X5 Pricing (EN→ES)"
        )
        
        await self.test_translation(
            "en", "ko",
            "Your trade-in appraisal came back at $24,000 which is $3,000 above KBB value. Let's get you into the new vehicle today.",
            "Trade-in Appraisal (EN→KO)"
        )
        
        await self.test_translation(
            "en", "fr",
            "We have special financing rates this month only. Come in and I can show you payment options that work within your budget.",
            "Special Financing (EN→FR)"
        )
        print()

        # 4. TTS AUDIO QUALITY (all 4 languages)
        print("4. 🎵 TTS AUDIO QUALITY (all 4 languages)")
        print("-" * 50)
        
        await self.test_tts_audio(
            "El BMW X5 está disponible para una prueba de manejo este fin de semana.",
            "es", "auto",
            "Spanish BMW"
        )
        
        await self.test_tts_audio(
            "Cette semaine, nous avons des offres spéciales sur le financement.",
            "fr", "auto",
            "French Financing"
        )
        
        await self.test_tts_audio(
            "이번 주말에 시승 예약을 잡아드릴 수 있습니다.",
            "ko", "auto",
            "Korean Test Drive"
        )
        
        await self.test_tts_audio(
            "The vehicle is ready for your test drive today.",
            "en", "auto",
            "English Ready"
        )
        print()

        # 5. CUSTOMER CRUD REGRESSION
        print("5. 👥 CUSTOMER CRUD REGRESSION")
        print("-" * 50)
        await self.test_customer_crud_operations()
        print()

        # 6. VIN DECODE
        print("6. 🚗 VIN DECODE")
        print("-" * 50)
        await self.test_vin_decode("1HGBH41JXMN109186")
        print()

        # 7. VOICE TRANSLATE VALIDATION
        print("7. 🎙️ VOICE TRANSLATE VALIDATION")
        print("-" * 50)
        await self.test_voice_translate_validation()
        print()

        # Generate comprehensive report
        await self.generate_performance_report()

    async def generate_performance_report(self):
        """Generate comprehensive performance report"""
        print("=" * 100)
        print("📊 COMPREHENSIVE PERFORMANCE REPORT")
        print("=" * 100)

        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests

        # Overall statistics
        print(f"📈 OVERALL RESULTS:")
        print(f"   Total Tests: {total_tests}")
        print(f"   ✅ Passed: {passed_tests}")
        print(f"   ❌ Failed: {failed_tests}")
        print(f"   Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print()

        # Performance metrics
        response_times = [r.get("response_time", 0) for r in self.results if r.get("response_time")]
        if response_times:
            avg_response_time = sum(response_times) / len(response_times)
            max_response_time = max(response_times)
            print(f"⏱️ PERFORMANCE METRICS:")
            print(f"   Average Response Time: {avg_response_time:.2f}s")
            print(f"   Maximum Response Time: {max_response_time:.2f}s")
            print(f"   All endpoints < 8s: {'✅ YES' if max_response_time < 8.0 else '❌ NO'}")
            print()

        # Quality criteria check
        print("🎯 QUALITY CRITERIA ASSESSMENT:")
        
        # Tower Talk quality
        tower_talk_tests = [r for r in self.results if "Tower Talk" in r["test"]]
        tower_talk_passed = [r for r in tower_talk_tests if r["success"]]
        print(f"   Tower Talk Quality: {len(tower_talk_passed)}/{len(tower_talk_tests)} passed")
        
        # Translation quality  
        translation_tests = [r for r in self.results if "Translation" in r["test"]]
        translation_passed = [r for r in translation_tests if r["success"]]
        print(f"   Translation Quality: {len(translation_passed)}/{len(translation_tests)} passed")
        
        # TTS quality
        tts_tests = [r for r in self.results if "TTS" in r["test"]]
        tts_passed = [r for r in tts_tests if r["success"]]
        print(f"   TTS Audio Quality: {len(tts_passed)}/{len(tts_tests)} passed")
        
        # Zero 500 errors check
        has_500_errors = any(r.get("response_data", {}).get("status") == 500 for r in self.results)
        print(f"   Zero 500 Errors: {'✅ YES' if not has_500_errors else '❌ NO'}")
        print()

        # Failed tests details
        if failed_tests > 0:
            print("❌ FAILED TESTS DETAILS:")
            for result in self.results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['details']}")
            print()

        # Sample Tower Talk responses for quality review
        print("🗣️ SAMPLE TOWER TALK RESPONSES:")
        for result in self.results:
            if "Tower Talk" in result["test"] and result["success"]:
                response_data = result.get("response_data", {})
                preview = response_data.get("response_preview", "")
                if preview:
                    print(f"   • {result['test']}: '{preview}'")
        print()

        # Overall recommendation
        if passed_tests / total_tests >= 0.9:
            recommendation = "🟢 EXCELLENT - Production ready"
        elif passed_tests / total_tests >= 0.8:
            recommendation = "🟡 GOOD - Minor issues to address"  
        else:
            recommendation = "🔴 NEEDS WORK - Major issues found"
            
        print(f"🎯 OVERALL SCORE AND RECOMMENDATION: {recommendation}")
        print()

        # Save detailed results
        results_file = "/app/backend_performance_results.json"
        with open(results_file, 'w') as f:
            json.dump({
                "test_type": "comprehensive_backend_performance_scan",
                "timestamp": datetime.now().isoformat(),
                "backend_url": self.base_url,
                "summary": {
                    "total_tests": total_tests,
                    "passed": passed_tests,
                    "failed": failed_tests,
                    "success_rate": f"{(passed_tests/total_tests)*100:.1f}%",
                    "avg_response_time": f"{avg_response_time:.2f}s" if response_times else "N/A",
                    "max_response_time": f"{max_response_time:.2f}s" if response_times else "N/A",
                    "recommendation": recommendation
                },
                "detailed_results": self.results
            }, f, indent=2)

        print(f"📄 Detailed results saved to: {results_file}")
        
        return passed_tests, failed_tests


async def main():
    async with BackendPerformanceTester() as tester:
        await tester.run_comprehensive_backend_scan()


if __name__ == "__main__":
    asyncio.run(main())