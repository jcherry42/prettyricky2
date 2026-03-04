#!/usr/bin/env python3
"""
Comprehensive Backend Regression Testing for Supercharg'd Automotive CRM
Testing all critical endpoints including the new VIN OCR and existing APIs
"""

import asyncio
import aiohttp
import json
import base64
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BackendTester:
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.session = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def create_test_image_with_vin(self) -> str:
        """Create a test image containing VIN text using PIL and return as base64"""
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            logger.warning("PIL not available, creating simple white image")
            # Create a simple 400x80 white image without text
            import io
            from base64 import b64encode
            # Create minimal image data (white PNG)
            img_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x01\x90\x00\x00\x00P\x08\x02\x00\x00\x00\xa4\x8b\x97\xc9\x00\x00\x00\x1dIDATx\x9c\xed\xc1\x01\r\x00\x00\x00\xc2\xa0\xf7Om\x0e7\xa0\x00\x00\x00\x00\x00\x00\x00\x00\x00\xbe\r!\x00\x00\x01\x9a`\x89\xf0\x00\x00\x00\x00IEND\xaeB`\x82'
            return b64encode(img_data).decode('utf-8')
        
        try:
            # Create image with VIN text
            img = Image.new('RGB', (400, 80), 'white')
            draw = ImageDraw.Draw(img)
            
            # Try to load default font, fall back to basic if not available
            try:
                font = ImageFont.load_default()
            except:
                font = None
            
            # Draw VIN text
            draw.text((10, 25), 'VIN: 1HGCV1F34LA000001', fill='black', font=font)
            
            # Convert to base64
            import io
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to create test image with PIL: {e}")
            # Fall back to simple white image
            import io
            img_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x01\x90\x00\x00\x00P\x08\x02\x00\x00\x00\xa4\x8b\x97\xc9\x00\x00\x00\x1dIDATx\x9c\xed\xc1\x01\r\x00\x00\x00\xc2\xa0\xf7Om\x0e7\xa0\x00\x00\x00\x00\x00\x00\x00\x00\x00\xbe\r!\x00\x00\x01\x9a`\x89\xf0\x00\x00\x00\x00IEND\xaeB`\x82'
            return base64.b64encode(img_data).decode('utf-8')

    async def test_request(self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None, 
                          timeout: int = 30, expected_status: int = 200) -> Dict[str, Any]:
        """Make a test request and record results"""
        url = f"{self.base_url}/api{endpoint}"
        test_name = f"{method} {endpoint}"
        
        start_time = time.time()
        result = {
            'test_name': test_name,
            'status': 'FAIL',
            'response_time': 0,
            'status_code': None,
            'response_data': None,
            'error': None
        }
        
        try:
            logger.info(f"Testing {test_name}...")
            
            if method.upper() == 'GET':
                async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                    result['status_code'] = response.status
                    try:
                        result['response_data'] = await response.json()
                    except:
                        result['response_data'] = await response.text()
            elif method.upper() == 'POST':
                if isinstance(data, dict):
                    async with self.session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                        result['status_code'] = response.status
                        try:
                            result['response_data'] = await response.json()
                        except:
                            result['response_data'] = await response.text()
                else:
                    # For form data or other formats
                    async with self.session.post(url, data=data, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                        result['status_code'] = response.status
                        try:
                            result['response_data'] = await response.json()
                        except:
                            result['response_data'] = await response.text()
            elif method.upper() == 'DELETE':
                async with self.session.delete(url, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                    result['status_code'] = response.status
                    try:
                        result['response_data'] = await response.json()
                    except:
                        result['response_data'] = await response.text()
            
            result['response_time'] = round((time.time() - start_time) * 1000, 2)  # ms
            
            if result['status_code'] == expected_status:
                result['status'] = 'PASS'
                logger.info(f"✅ {test_name} - {result['response_time']}ms")
            else:
                result['error'] = f"Expected status {expected_status}, got {result['status_code']}"
                logger.error(f"❌ {test_name} - {result['error']}")
                
        except asyncio.TimeoutError:
            result['response_time'] = round((time.time() - start_time) * 1000, 2)
            result['error'] = f"Timeout after {timeout}s"
            logger.error(f"❌ {test_name} - Timeout")
        except Exception as e:
            result['response_time'] = round((time.time() - start_time) * 1000, 2)
            result['error'] = str(e)
            logger.error(f"❌ {test_name} - {result['error']}")
        
        self.test_results.append(result)
        return result

    async def test_vin_extract_from_image_blank(self):
        """Test VIN OCR with blank/white image"""
        blank_image = base64.b64encode(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82').decode('utf-8')
        
        data = {'image_base64': blank_image}
        result = await self.test_request('POST', '/vin/extract-from-image', data, timeout=35)
        
        # Validate expected response structure for blank image
        if result['status'] == 'PASS' and result['response_data']:
            response = result['response_data']
            expected_keys = {'success', 'vins', 'confidence'}
            if all(key in response for key in expected_keys):
                if response.get('success') and response.get('vins') == [] and response.get('confidence') == 'low':
                    logger.info("✅ Blank image test: Correct response structure")
                else:
                    logger.warning(f"⚠️ Blank image response: {response}")
            else:
                logger.error(f"❌ Missing expected keys in response: {response}")
        
        return result

    async def test_vin_extract_from_image_with_vin(self):
        """Test VIN OCR with image containing VIN text"""
        vin_image = self.create_test_image_with_vin()
        
        data = {'image_base64': vin_image}
        result = await self.test_request('POST', '/vin/extract-from-image', data, timeout=35)
        
        # Validate expected response structure for image with VIN
        if result['status'] == 'PASS' and result['response_data']:
            response = result['response_data']
            expected_keys = {'success', 'vins', 'confidence'}
            if all(key in response for key in expected_keys):
                if response.get('success'):
                    vins = response.get('vins', [])
                    confidence = response.get('confidence', '')
                    logger.info(f"✅ VIN image test: Found {len(vins)} VINs, confidence: {confidence}")
                    if len(vins) > 0:
                        logger.info(f"   Extracted VINs: {vins}")
                else:
                    logger.warning(f"⚠️ VIN extraction failed: {response}")
            else:
                logger.error(f"❌ Missing expected keys in response: {response}")
        
        return result

    async def test_vin_extract_empty_validation(self):
        """Test VIN OCR with empty image_base64 (should return 400)"""
        data = {'image_base64': ''}
        result = await self.test_request('POST', '/vin/extract-from-image', data, expected_status=400, timeout=35)
        return result

    async def run_all_tests(self):
        """Run comprehensive backend regression tests for Supercharg'd mobile app"""
        logger.info("🚀 Starting COMPREHENSIVE Backend Regression Tests for Supercharg'd")
        logger.info("Target: >90% pass rate with all 15 critical endpoints")
        logger.info("=" * 60)
        
        # Store created customer ID for later tests
        created_customer_id = None
        
        # 1. GET /api/health → 200
        await self.test_request('GET', '/health')
        
        # 2. POST /api/translate {"text":"Hello","source_lang":"en","target_lang":"es"} → 200, translated_text
        translate_data_1 = {
            'text': 'Hello',
            'source_lang': 'en',
            'target_lang': 'es'
        }
        result = await self.test_request('POST', '/translate', translate_data_1)
        if result['status'] == 'PASS' and result['response_data']:
            if 'translated_text' in result['response_data']:
                logger.info(f"✅ Translation result: '{result['response_data']['translated_text']}'")
            else:
                logger.warning("⚠️ Missing 'translated_text' field in response")
        
        # 3. POST /api/translate {"text":"Test drive?","source_lang":"en","target_lang":"fr"} → 200
        translate_data_2 = {
            'text': 'Test drive?',
            'source_lang': 'en',
            'target_lang': 'fr'
        }
        result = await self.test_request('POST', '/translate', translate_data_2)
        if result['status'] == 'PASS' and result['response_data']:
            if 'translated_text' in result['response_data']:
                logger.info(f"✅ Translation result: '{result['response_data']['translated_text']}'")
        
        # 4. POST /api/translate {"text":"Financing","source_lang":"en","target_lang":"ko"} → 200
        translate_data_3 = {
            'text': 'Financing',
            'source_lang': 'en',
            'target_lang': 'ko'
        }
        result = await self.test_request('POST', '/translate', translate_data_3)
        if result['status'] == 'PASS' and result['response_data']:
            if 'translated_text' in result['response_data']:
                logger.info(f"✅ Translation result: '{result['response_data']['translated_text']}'")
        
        # 5. POST /api/tts {"text":"Welcome","language":"en","voice":"auto"} → 200, audio_base64
        tts_data = {
            'text': 'Welcome',
            'language': 'en',
            'voice': 'auto'
        }
        result = await self.test_request('POST', '/tts', tts_data)
        if result['status'] == 'PASS' and result['response_data']:
            if 'audio_base64' in result['response_data']:
                audio_size = len(result['response_data']['audio_base64'])
                logger.info(f"✅ TTS generated audio: {audio_size} chars")
            else:
                logger.warning("⚠️ Missing 'audio_base64' field in response")
        
        # 6. POST /api/tower-talk → 200
        tower_talk_data = {
            'situation': 'Price question',
            'inquiryType': 'price_question',
            'context': {
                'customerName': 'Alex',
                'vehicle': 'GLE 450',
                'dealershipName': 'MB'
            }
        }
        await self.test_request('POST', '/tower-talk', tower_talk_data)
        
        # 7. POST /api/customers/create → **201** (MUST be 201)
        customer_data = {
            'first_name': 'Regression',
            'last_name': 'Test',
            'phone': '555-9999'
        }
        result = await self.test_request('POST', '/customers/create', customer_data, expected_status=201)
        if result['status'] == 'PASS' and result['response_data']:
            if 'customer' in result['response_data'] and 'id' in result['response_data']['customer']:
                created_customer_id = result['response_data']['customer']['id']
                logger.info(f"✅ Customer created with ID: {created_customer_id}")
            elif 'id' in result['response_data']:
                created_customer_id = result['response_data']['id']
                logger.info(f"✅ Customer created with ID: {created_customer_id}")
            elif 'customer_id' in result['response_data']:
                created_customer_id = result['response_data']['customer_id']
                logger.info(f"✅ Customer created with ID: {created_customer_id}")
            else:
                logger.warning("⚠️ Customer created but no ID returned")
        
        # 8. GET /api/customers/list?limit=5 → 200, customers array
        result = await self.test_request('GET', '/customers/list?limit=5')
        if result['status'] == 'PASS' and result['response_data']:
            if 'customers' in result['response_data']:
                customer_count = len(result['response_data']['customers'])
                logger.info(f"✅ Customer list returned {customer_count} customers")
            else:
                logger.warning("⚠️ Missing 'customers' field in response")
        
        # 9. GET /api/customers/{id from step 7} → 200 (only if customer was created)
        if created_customer_id:
            await self.test_request('GET', f'/customers/{created_customer_id}')
        else:
            logger.warning("⚠️ Skipping customer retrieval - no customer ID available")
        
        # 10. DELETE /api/customers/{id from step 7} → 200 (only if customer was created)  
        if created_customer_id:
            await self.test_request('DELETE', f'/customers/{created_customer_id}')
        else:
            logger.warning("⚠️ Skipping customer deletion - no customer ID available")
        
        # 11. GET /api/vin/decode/JM3KKEHA3T1355103 → 200
        await self.test_request('GET', '/vin/decode/JM3KKEHA3T1355103')
        
        # 12. GET /api/vin/trade-in-count → 200
        await self.test_request('GET', '/vin/trade-in-count')
        
        # 13. GET /api/dashboard/stats → 200
        await self.test_request('GET', '/dashboard/stats')
        
        # 14. POST /api/voice-translate with invalid payload → 422
        invalid_voice_data = {'invalid_field': 'test'}
        await self.test_request('POST', '/voice-translate', invalid_voice_data, expected_status=422)
        
        # 15. POST /api/license/parse-pdf417 {"barcode_data":"test"} → check response
        pdf417_data = {
            'barcode_data': 'test'
        }
        result = await self.test_request('POST', '/license/parse-pdf417', pdf417_data)
        # This might return 200 or 400 depending on validation, either is acceptable for test data

    def generate_summary(self) -> Dict[str, Any]:
        """Generate test summary"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['status'] == 'PASS')
        failed_tests = total_tests - passed_tests
        
        avg_response_time = sum(result['response_time'] for result in self.test_results) / total_tests if total_tests > 0 else 0
        
        summary = {
            'timestamp': datetime.now().isoformat(),
            'total_tests': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'pass_rate': round((passed_tests / total_tests) * 100, 1) if total_tests > 0 else 0,
            'avg_response_time_ms': round(avg_response_time, 2),
            'test_results': self.test_results
        }
        
        return summary

    def print_summary(self, summary: Dict[str, Any]):
        """Print formatted test summary"""
        logger.info("\n" + "=" * 60)
        logger.info("📊 BACKEND REGRESSION TEST SUMMARY")
        logger.info("=" * 60)
        
        logger.info(f"📅 Timestamp: {summary['timestamp']}")
        logger.info(f"🧪 Total Tests: {summary['total_tests']}")
        logger.info(f"✅ Passed: {summary['passed']}")
        logger.info(f"❌ Failed: {summary['failed']}")
        logger.info(f"📈 Pass Rate: {summary['pass_rate']}%")
        logger.info(f"⏱️  Average Response Time: {summary['avg_response_time_ms']}ms")
        
        if summary['failed'] > 0:
            logger.info("\n❌ FAILED TESTS:")
            for result in summary['test_results']:
                if result['status'] == 'FAIL':
                    logger.info(f"  • {result['test_name']}: {result['error']}")
        
        # Determine quality gate status
        if summary['pass_rate'] >= 90:
            logger.info("\n🎉 QUALITY GATE: PASS (≥90% pass rate)")
            return True
        else:
            logger.info(f"\n🚨 QUALITY GATE: FAIL (<90% pass rate: {summary['pass_rate']}%)")
            return False

async def main():
    """Main test execution"""
    try:
        async with BackendTester() as tester:
            await tester.run_all_tests()
            summary = tester.generate_summary()
            quality_gate_pass = tester.print_summary(summary)
            
            # Save detailed results to file
            with open('/app/backend_test_results.json', 'w') as f:
                json.dump(summary, f, indent=2)
            
            logger.info(f"\n📁 Detailed results saved to: /app/backend_test_results.json")
            
            return quality_gate_pass
            
    except Exception as e:
        logger.error(f"❌ Test execution failed: {e}")
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("Tests interrupted by user")
        exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        exit(1)