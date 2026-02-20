#!/usr/bin/env python3
"""
COMPREHENSIVE QUALITY SCAN - Supercharg'd Backend Testing
Target: 100% pass rate - most stringent testing possible
Backend at http://localhost:8001
"""

import asyncio
import aiohttp
import json
import logging
import base64
import time
import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class TestResult:
    test_name: str
    passed: bool
    response_time: float
    status_code: Optional[int] = None
    response_data: Optional[Any] = None
    error_message: Optional[str] = None
    details: Optional[str] = None

class SuperchargdBackendTester:
    """
    Comprehensive backend tester for Supercharg'd system
    Covers all endpoints with stringent quality checks
    """
    
    def __init__(self):
        self.base_url = "http://localhost:8001/api"
        self.results: List[TestResult] = []
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=10)
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def log_result(self, result: TestResult):
        """Log and store test result"""
        self.results.append(result)
        status = "✅ PASS" if result.passed else "❌ FAIL"
        logger.info(f"{status} - {result.test_name} ({result.response_time:.3f}s)")
        if not result.passed and result.error_message:
            logger.error(f"  Error: {result.error_message}")
        if result.details:
            logger.info(f"  Details: {result.details}")

    async def make_request(self, method: str, endpoint: str, **kwargs) -> tuple:
        """Make HTTP request and measure response time"""
        url = f"{self.base_url}{endpoint}"
        start_time = time.time()
        
        try:
            async with self.session.request(method, url, **kwargs) as response:
                response_time = time.time() - start_time
                
                # Try to parse JSON response
                try:
                    if response.content_type and 'application/json' in response.content_type:
                        data = await response.json()
                    else:
                        text = await response.text()
                        # Try to parse as JSON even if content-type is wrong
                        try:
                            data = json.loads(text)
                        except:
                            data = text
                except:
                    data = await response.text()
                
                return response.status, data, response_time, None
                
        except Exception as e:
            response_time = time.time() - start_time
            return None, None, response_time, str(e)

    # ============== HEALTH + PERFORMANCE ==============
    
    async def test_health_check(self):
        """Test GET /api/health - verify healthy, measure latency"""
        status, data, response_time, error = await self.make_request('GET', '/health')
        
        passed = False
        details = None
        
        if error:
            error_message = f"Request failed: {error}"
        elif status == 200:
            if isinstance(data, dict) and data.get('status') == 'healthy':
                passed = True
                details = f"Status: {data.get('status')}, Latency: {response_time*1000:.1f}ms"
                if response_time > 1.0:
                    details += " (WARNING: High latency)"
            else:
                error_message = f"Invalid response: {data}"
        else:
            error_message = f"HTTP {status}: {data}"
        
        self.log_result(TestResult(
            test_name="Health Check",
            passed=passed,
            response_time=response_time,
            status_code=status,
            response_data=data,
            error_message=error_message if not passed else None,
            details=details
        ))

    async def test_customers_list_performance(self):
        """Test GET /api/customers/list - measure latency, verify structure"""
        status, data, response_time, error = await self.make_request('GET', '/customers/list')
        
        passed = False
        details = None
        
        if error:
            error_message = f"Request failed: {error}"
        elif status == 200:
            if isinstance(data, dict) and 'customers' in data and 'total' in data:
                passed = True
                customer_count = len(data.get('customers', []))
                total = data.get('total', 0)
                details = f"Customers: {customer_count}, Total: {total}, Latency: {response_time*1000:.1f}ms"
                if response_time > 2.0:
                    details += " (WARNING: High latency)"
            else:
                error_message = f"Invalid response structure: {data}"
        else:
            error_message = f"HTTP {status}: {data}"
            
        self.log_result(TestResult(
            test_name="Customer List Performance",
            passed=passed,
            response_time=response_time,
            status_code=status,
            response_data=data,
            error_message=error_message if not passed else None,
            details=details
        ))

    # ============== TOWER TALK - ALL 8 INQUIRY TYPES ==============
    
    def validate_tower_talk_quality(self, response_text: str, inquiry_type: str) -> tuple:
        """
        Validate Tower Talk response quality:
        - NO emojis
        - 2-3 sentences
        - Professional tone
        - Signs off with first name
        """
        if not response_text:
            return False, "Empty response"
        
        # Check for emojis (Unicode emoji ranges)
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"  # emoticons
            "\U0001F300-\U0001F5FF"  # symbols & pictographs
            "\U0001F680-\U0001F6FF"  # transport & map symbols
            "\U0001F1E0-\U0001F1FF"  # flags (iOS)
            "\U00002600-\U000027BF"  # misc symbols
            "\U0001F900-\U0001F9FF"  # supplemental symbols
            "]+", flags=re.UNICODE
        )
        
        if emoji_pattern.search(response_text):
            return False, "Contains emojis (violates NO emojis rule)"
        
        # Count sentences (rough estimate)
        sentences = re.split(r'[.!?]+', response_text.strip())
        sentences = [s.strip() for s in sentences if s.strip()]
        sentence_count = len(sentences)
        
        if sentence_count < 2:
            return False, f"Too few sentences: {sentence_count} (expected 2-3)"
        if sentence_count > 4:
            return False, f"Too many sentences: {sentence_count} (expected 2-3)"
        
        # Check for professional tone (basic checks)
        lower_text = response_text.lower()
        unprofessional_words = ['lol', 'omg', 'wtf', 'awesome', 'epic', 'lit']
        for word in unprofessional_words:
            if word in lower_text:
                return False, f"Unprofessional language: '{word}'"
        
        # Check for first name sign-off (simple heuristic)
        words = response_text.split()
        last_word = words[-1] if words else ""
        # Look for common first names or sign-off patterns
        if len(last_word) < 2 or not last_word.isalpha():
            return False, "Does not sign off with first name"
        
        return True, f"Quality check PASSED: {sentence_count} sentences, professional tone, signs off with '{last_word}'"

    async def test_tower_talk_inquiry(self, inquiry_type: str, situation: str, context: dict):
        """Test a specific Tower Talk inquiry type"""
        payload = {
            "situation": situation,
            "inquiryType": inquiry_type,
            "context": context
        }
        
        status, data, response_time, error = await self.make_request(
            'POST', '/tower-talk', 
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        
        passed = False
        details = None
        
        if error:
            error_message = f"Request failed: {error}"
        elif status == 200:
            if isinstance(data, dict) and 'response' in data:
                response_text = data['response']
                quality_passed, quality_msg = self.validate_tower_talk_quality(response_text, inquiry_type)
                
                if quality_passed:
                    passed = True
                    details = f"Response length: {len(response_text)} chars. {quality_msg}"
                else:
                    error_message = f"Quality check failed: {quality_msg}"
                    details = f"Response: '{response_text[:100]}...'"
            else:
                error_message = f"Invalid response structure: {data}"
        else:
            error_message = f"HTTP {status}: {data}"
            
        self.log_result(TestResult(
            test_name=f"Tower Talk - {inquiry_type}",
            passed=passed,
            response_time=response_time,
            status_code=status,
            response_data=response_text if passed else data,
            error_message=error_message if not passed else None,
            details=details
        ))

    async def test_all_tower_talk_inquiries(self):
        """Test all 8 Tower Talk inquiry types with strict quality checks"""
        inquiries = [
            {
                "type": "new_lead",
                "situation": "Customer texted about 2024 Porsche 911",
                "context": {
                    "customerName": "Alex Kim",
                    "vehicle": "2024 Porsche 911",
                    "dealershipName": "Premier Motorsports",
                    "salespersonName": "Jake"
                }
            },
            {
                "type": "price_question",
                "situation": "Customer says they found same car $4000 cheaper at another dealer",
                "context": {
                    "customerName": "Maria Garcia",
                    "vehicle": "2023 BMW M3",
                    "vehiclePrice": "$76000",
                    "salespersonName": "Carlos"
                }
            },
            {
                "type": "availability",
                "situation": "Customer asking if specific trim level is in stock",
                "context": {
                    "customerName": "James Lee",
                    "vehicle": "2024 Tesla Model 3 Performance"
                }
            },
            {
                "type": "trade_in",
                "situation": "Customer has 2020 Toyota Camry to trade in, 45000 miles",
                "context": {
                    "customerName": "Sarah Chen",
                    "vehicle": "2024 Mazda CX-5",
                    "tradeMileage": "45000"
                }
            },
            {
                "type": "financing",
                "situation": "Customer worried about credit score affecting approval",
                "context": {
                    "customerName": "Michael Torres",
                    "vehicle": "2024 Lexus RX 350",
                    "salespersonName": "Diana"
                }
            },
            {
                "type": "test_drive",
                "situation": "Customer wants to test drive Saturday morning",
                "context": {
                    "customerName": "Emily Davis",
                    "vehicle": "2024 Ford Mustang GT",
                    "salespersonName": "Ryan"
                }
            },
            {
                "type": "follow_up",
                "situation": "No response after last week visit",
                "context": {
                    "customerName": "Tom Wilson",
                    "vehicle": "2024 Dodge Charger"
                }
            },
            {
                "type": "objection",
                "situation": "Customer says not ready to buy for 3 months",
                "context": {
                    "customerName": "Lisa Park",
                    "vehicle": "2024 Mercedes GLE",
                    "salespersonName": "Sophie"
                }
            }
        ]
        
        for inquiry in inquiries:
            await self.test_tower_talk_inquiry(
                inquiry["type"],
                inquiry["situation"],
                inquiry["context"]
            )

    # ============== TRANSLATION (4 LANGUAGES) ==============
    
    async def test_translation(self, text: str, source_lang: str, target_lang: str, test_name: str):
        """Test translation endpoint"""
        payload = {
            "text": text,
            "source_lang": source_lang,
            "target_lang": target_lang
        }
        
        status, data, response_time, error = await self.make_request(
            'POST', '/translate',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        
        passed = False
        details = None
        
        if error:
            error_message = f"Request failed: {error}"
        elif status == 200:
            if isinstance(data, dict) and 'translated_text' in data:
                translated_text = data['translated_text']
                if translated_text and len(translated_text.strip()) > 0:
                    passed = True
                    confidence = data.get('confidence', 'N/A')
                    detected_lang = data.get('detected_lang', 'N/A')
                    details = f"Translation: '{translated_text}', Confidence: {confidence}, Detected: {detected_lang}"
                else:
                    error_message = "Empty translation result"
            else:
                error_message = f"Invalid response structure: {data}"
        else:
            error_message = f"HTTP {status}: {data}"
            
        self.log_result(TestResult(
            test_name=f"Translation - {test_name}",
            passed=passed,
            response_time=response_time,
            status_code=status,
            response_data=data,
            error_message=error_message if not passed else None,
            details=details
        ))

    async def test_all_translations(self):
        """Test all 4 language translations"""
        translations = [
            {
                "text": "The 2024 BMW X5 is available for immediate delivery with 0% APR financing for 36 months.",
                "source": "en",
                "target": "es",
                "name": "EN→ES (BMW financing)"
            },
            {
                "text": "We offer complimentary vehicle detailing and a full tank of gas with every purchase.",
                "source": "en", 
                "target": "ko",
                "name": "EN→KO (Complimentary services)"
            },
            {
                "text": "Your trade-in has been appraised at above market value. Come in today to finalize the deal.",
                "source": "en",
                "target": "fr", 
                "name": "EN→FR (Trade-in appraisal)"
            },
            {
                "text": "This weekend we have a special event with exclusive test drive opportunities.",
                "source": "en",
                "target": "ja",
                "name": "EN→JA (Special event)"
            }
        ]
        
        for trans in translations:
            await self.test_translation(
                trans["text"],
                trans["source"],
                trans["target"],
                trans["name"]
            )

    # ============== TTS (ALL 4 LANGUAGES) ==============
    
    async def test_tts(self, text: str, language: str, test_name: str):
        """Test text-to-speech endpoint"""
        payload = {
            "text": text,
            "voice": "auto",
            "language": language
        }
        
        status, data, response_time, error = await self.make_request(
            'POST', '/tts',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        
        passed = False
        details = None
        
        if error:
            error_message = f"Request failed: {error}"
        elif status == 200:
            if isinstance(data, dict) and 'audio_base64' in data:
                audio_base64 = data['audio_base64']
                if audio_base64 and len(audio_base64) > 0:
                    passed = True
                    voice_used = data.get('voice_used', 'unknown')
                    cached = data.get('cached', False)
                    details = f"Audio length: {len(audio_base64)} chars, Voice: {voice_used}, Cached: {cached}"
                else:
                    error_message = "Empty audio data"
            else:
                error_message = f"Invalid response structure: {data}"
        else:
            error_message = f"HTTP {status}: {data}"
            
        self.log_result(TestResult(
            test_name=f"TTS - {test_name}",
            passed=passed,
            response_time=response_time,
            status_code=status,
            response_data=len(data.get('audio_base64', '')) if isinstance(data, dict) else data,
            error_message=error_message if not passed else None,
            details=details
        ))

    async def test_all_tts(self):
        """Test TTS for all 4 languages"""
        tts_tests = [
            {"text": "Welcome to our dealership, how can we help you today?", "lang": "en", "name": "English"},
            {"text": "Bienvenido a nuestro concesionario, ¿cómo podemos ayudarle hoy?", "lang": "es", "name": "Spanish"},
            {"text": "Bienvenue dans notre concession, comment pouvons-nous vous aider aujourd'hui?", "lang": "fr", "name": "French"},
            {"text": "저희 대리점에 오신 것을 환영합니다. 오늘 어떻게 도와드릴까요?", "lang": "ko", "name": "Korean"}
        ]
        
        for tts in tts_tests:
            await self.test_tts(tts["text"], tts["lang"], tts["name"])

    # ============== CUSTOMER LIFECYCLE ==============
    
    async def test_customer_lifecycle(self):
        """Test full customer CRUD lifecycle"""
        # Create customer
        customer_data = {
            "first_name": "John",
            "last_name": "TestCustomer",
            "phone": "555-TEST-123",
            "email": "john.testcustomer@example.com",
            "vehicle_interest": "2024 BMW X5",
            "lead_status": "new"
        }
        
        status, data, response_time, error = await self.make_request(
            'POST', '/customers',
            json=customer_data,
            headers={'Content-Type': 'application/json'}
        )
        
        customer_id = None
        
        if status in [200, 201] and isinstance(data, dict):
            customer_id = data.get('id') or data.get('customer_id')
            if customer_id:
                self.log_result(TestResult(
                    test_name="Customer Create",
                    passed=True,
                    response_time=response_time,
                    status_code=status,
                    response_data=customer_id,
                    details=f"Customer created with ID: {customer_id}"
                ))
            else:
                self.log_result(TestResult(
                    test_name="Customer Create",
                    passed=False,
                    response_time=response_time,
                    status_code=status,
                    error_message="No customer ID in response",
                    response_data=data
                ))
                return
        else:
            self.log_result(TestResult(
                test_name="Customer Create",
                passed=False,
                response_time=response_time,
                status_code=status,
                error_message=error or f"HTTP {status}: {data}",
                response_data=data
            ))
            return

        # List customers (verify creation)
        status, data, response_time, error = await self.make_request('GET', '/customers/list')
        
        if status == 200 and isinstance(data, dict):
            customers = data.get('customers', [])
            found_customer = any(c.get('id') == customer_id for c in customers)
            self.log_result(TestResult(
                test_name="Customer List (verify)",
                passed=found_customer,
                response_time=response_time,
                status_code=status,
                details=f"Found {len(customers)} customers, test customer {'found' if found_customer else 'NOT found'}"
            ))
        else:
            self.log_result(TestResult(
                test_name="Customer List (verify)",
                passed=False,
                response_time=response_time,
                status_code=status,
                error_message=error or f"HTTP {status}: {data}"
            ))

        # Search customer
        status, data, response_time, error = await self.make_request(
            'GET', '/customers/list',
            params={'search': 'TestCustomer'}
        )
        
        if status == 200 and isinstance(data, dict):
            customers = data.get('customers', [])
            found_customer = any('TestCustomer' in c.get('last_name', '') for c in customers)
            self.log_result(TestResult(
                test_name="Customer Search",
                passed=found_customer,
                response_time=response_time,
                status_code=status,
                details=f"Search returned {len(customers)} customers"
            ))
        else:
            self.log_result(TestResult(
                test_name="Customer Search",
                passed=False,
                response_time=response_time,
                status_code=status,
                error_message=error or f"HTTP {status}: {data}"
            ))

        # Update customer
        update_data = {"lead_status": "qualified"}
        status, data, response_time, error = await self.make_request(
            'PATCH', f'/customers/{customer_id}',
            json=update_data,
            headers={'Content-Type': 'application/json'}
        )
        
        update_passed = status in [200, 201] and isinstance(data, dict)
        self.log_result(TestResult(
            test_name="Customer Update",
            passed=update_passed,
            response_time=response_time,
            status_code=status,
            details="Status updated to qualified" if update_passed else None,
            error_message=None if update_passed else (error or f"HTTP {status}: {data}")
        ))

        # Delete customer
        status, data, response_time, error = await self.make_request(
            'DELETE', f'/customers/{customer_id}'
        )
        
        delete_passed = status in [200, 204]
        self.log_result(TestResult(
            test_name="Customer Delete",
            passed=delete_passed,
            response_time=response_time,
            status_code=status,
            details="Customer deleted successfully" if delete_passed else None,
            error_message=None if delete_passed else (error or f"HTTP {status}: {data}")
        ))

        # Verify deletion
        status, data, response_time, error = await self.make_request(
            'GET', f'/customers/{customer_id}'
        )
        
        verify_passed = status == 404
        self.log_result(TestResult(
            test_name="Customer Delete Verification",
            passed=verify_passed,
            response_time=response_time,
            status_code=status,
            details="Customer properly deleted (404 response)" if verify_passed else "Customer still exists",
            error_message=None if verify_passed else f"Expected 404, got {status}"
        ))

    # ============== VIN DECODE ==============
    
    async def test_vin_decode(self, vin: str, test_name: str):
        """Test VIN decode endpoint"""
        status, data, response_time, error = await self.make_request(
            'GET', f'/vin/decode/{vin}'
        )
        
        passed = False
        details = None
        
        if error:
            error_message = f"Request failed: {error}"
        elif status == 200:
            if isinstance(data, dict):
                # Check for common VIN decode fields
                if 'make' in data and 'model' in data and 'year' in data:
                    passed = True
                    make = data.get('make', 'Unknown')
                    model = data.get('model', 'Unknown')
                    year = data.get('year', 'Unknown')
                    details = f"Decoded: {year} {make} {model}"
                elif 'error' in data:
                    error_message = f"VIN decode error: {data['error']}"
                else:
                    error_message = f"Unexpected response format: {data}"
            else:
                error_message = f"Invalid response type: {type(data)}"
        else:
            error_message = f"HTTP {status}: {data}"
            
        self.log_result(TestResult(
            test_name=f"VIN Decode - {test_name}",
            passed=passed,
            response_time=response_time,
            status_code=status,
            response_data=data,
            error_message=error_message if not passed else None,
            details=details
        ))

    async def test_all_vin_decodes(self):
        """Test VIN decode for provided VINs"""
        vins = [
            {"vin": "JM3KKEHA3T1355103", "name": "Mazda VIN"},
            {"vin": "1HGBH41JXMN109186", "name": "Honda VIN"}
        ]
        
        for vin_test in vins:
            await self.test_vin_decode(vin_test["vin"], vin_test["name"])

    # ============== ERROR HANDLING ==============
    
    async def test_error_handling(self):
        """Test error handling for various scenarios"""
        
        # Test empty text translation - should return 400
        status, data, response_time, error = await self.make_request(
            'POST', '/translate',
            json={"text": "", "target_lang": "es"},
            headers={'Content-Type': 'application/json'}
        )
        
        expected_400 = status == 400
        self.log_result(TestResult(
            test_name="Error Handling - Empty translation",
            passed=expected_400,
            response_time=response_time,
            status_code=status,
            details="Correctly returned 400 for empty text" if expected_400 else f"Expected 400, got {status}",
            error_message=None if expected_400 else f"Should return 400 for empty text, got {status}"
        ))

        # Test empty Tower Talk situation
        status, data, response_time, error = await self.make_request(
            'POST', '/tower-talk',
            json={"situation": "", "context": {}},
            headers={'Content-Type': 'application/json'}
        )
        
        # Check behavior - could be 400 or could handle gracefully
        graceful_handling = status in [200, 400]
        self.log_result(TestResult(
            test_name="Error Handling - Empty Tower Talk situation",
            passed=graceful_handling,
            response_time=response_time,
            status_code=status,
            details=f"Handled empty situation with status {status}",
            error_message=None if graceful_handling else f"Unexpected error handling: {status}"
        ))

        # Test invalid customer ID - should return 404
        invalid_id = "invalid-customer-id-12345"
        status, data, response_time, error = await self.make_request(
            'GET', f'/customers/{invalid_id}'
        )
        
        expected_404 = status == 404
        self.log_result(TestResult(
            test_name="Error Handling - Invalid customer ID",
            passed=expected_404,
            response_time=response_time,
            status_code=status,
            details="Correctly returned 404 for invalid ID" if expected_404 else f"Expected 404, got {status}",
            error_message=None if expected_404 else f"Should return 404 for invalid customer ID, got {status}"
        ))

    # ============== MAIN TEST RUNNER ==============
    
    async def run_all_tests(self):
        """Run comprehensive test suite"""
        logger.info("🎯 STARTING COMPREHENSIVE QUALITY SCAN - Supercharg'd Backend")
        logger.info(f"Target: 100% pass rate - Backend at {self.base_url}")
        start_time = time.time()
        
        # A. HEALTH + PERFORMANCE
        logger.info("\n📊 SECTION A: HEALTH + PERFORMANCE")
        await self.test_health_check()
        await self.test_customers_list_performance()
        
        # B. TOWER TALK - ALL 8 INQUIRY TYPES  
        logger.info("\n🎭 SECTION B: TOWER TALK - ALL 8 INQUIRY TYPES (strict quality checks)")
        await self.test_all_tower_talk_inquiries()
        
        # C. TRANSLATION (4 languages)
        logger.info("\n🌐 SECTION C: TRANSLATION (4 languages)")
        await self.test_all_translations()
        
        # D. TTS (all 4 languages)
        logger.info("\n🔊 SECTION D: TTS (all 4 languages)")
        await self.test_all_tts()
        
        # E. CUSTOMER LIFECYCLE
        logger.info("\n👤 SECTION E: CUSTOMER LIFECYCLE")
        await self.test_customer_lifecycle()
        
        # F. VIN DECODE
        logger.info("\n🚗 SECTION F: VIN DECODE")
        await self.test_all_vin_decodes()
        
        # G. ERROR HANDLING
        logger.info("\n⚠️ SECTION G: ERROR HANDLING")
        await self.test_error_handling()
        
        # Calculate results
        total_time = time.time() - start_time
        passed_count = sum(1 for r in self.results if r.passed)
        total_count = len(self.results)
        pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0
        
        # Generate detailed report
        self.generate_final_report(passed_count, total_count, pass_rate, total_time)
        
        return pass_rate >= 100.0

    def generate_final_report(self, passed: int, total: int, pass_rate: float, total_time: float):
        """Generate comprehensive test report"""
        logger.info("\n" + "="*80)
        logger.info("🎯 COMPREHENSIVE QUALITY SCAN RESULTS")
        logger.info("="*80)
        
        # Overall results
        status_emoji = "✅" if pass_rate >= 100.0 else "⚠️" if pass_rate >= 90.0 else "❌"
        logger.info(f"{status_emoji} OVERALL: {passed}/{total} tests passed ({pass_rate:.1f}%)")
        logger.info(f"⏱️ Total time: {total_time:.2f} seconds")
        
        # Group results by category
        categories = {}
        for result in self.results:
            category = result.test_name.split(' - ')[0] if ' - ' in result.test_name else "General"
            if category not in categories:
                categories[category] = {"passed": 0, "total": 0, "results": []}
            categories[category]["total"] += 1
            if result.passed:
                categories[category]["passed"] += 1
            categories[category]["results"].append(result)
        
        # Report by category
        for category, stats in categories.items():
            cat_rate = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            cat_emoji = "✅" if cat_rate >= 100.0 else "⚠️" if cat_rate >= 90.0 else "❌"
            logger.info(f"\n{cat_emoji} {category.upper()}: {stats['passed']}/{stats['total']} ({cat_rate:.1f}%)")
            
            # Show failed tests
            failed_tests = [r for r in stats["results"] if not r.passed]
            if failed_tests:
                logger.info("   Failed tests:")
                for test in failed_tests:
                    logger.info(f"   ❌ {test.test_name}: {test.error_message}")
        
        # Production readiness assessment
        logger.info(f"\n🚀 PRODUCTION READINESS: {'READY' if pass_rate >= 100.0 else 'NEEDS ATTENTION'}")
        
        if pass_rate < 100.0:
            logger.info("\n🔧 ISSUES TO ADDRESS:")
            failed_tests = [r for r in self.results if not r.passed]
            for i, test in enumerate(failed_tests, 1):
                logger.info(f"{i}. {test.test_name}: {test.error_message}")
        
        # Performance insights
        slow_tests = [r for r in self.results if r.response_time > 2.0]
        if slow_tests:
            logger.info(f"\n⏳ PERFORMANCE WARNINGS ({len(slow_tests)} slow responses > 2s):")
            for test in slow_tests:
                logger.info(f"   {test.test_name}: {test.response_time:.3f}s")
        
        logger.info("="*80)


async def main():
    """Main test execution"""
    async with SuperchargdBackendTester() as tester:
        success = await tester.run_all_tests()
        return success

if __name__ == "__main__":
    asyncio.run(main())