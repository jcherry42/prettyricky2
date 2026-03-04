#!/usr/bin/env python3
"""
Supercharg'd Automotive Mobile App Backend Comprehensive Regression Test
Testing all 10 critical endpoints specified in the review request
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

class BackendRegressionTester:
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
                async with self.session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
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

    async def run_regression_tests(self):
        """Run the exact 10 tests specified in the review request"""
        logger.info("🚀 Starting SUPERCHARG'D BACKEND COMPREHENSIVE REGRESSION TEST")
        logger.info("Testing exactly 10 critical endpoints as specified in review")
        logger.info("Target: >90% pass rate")
        logger.info("Backend URL: http://localhost:8001")
        logger.info("=" * 70)
        
        # 1. GET /api/health → should return healthy status
        result = await self.test_request('GET', '/health')
        if result['status'] == 'PASS' and result['response_data']:
            if isinstance(result['response_data'], dict) and result['response_data'].get('status') == 'healthy':
                logger.info("✅ Health check returns healthy status")
            else:
                logger.warning(f"⚠️ Health response: {result['response_data']}")
        
        # 2. POST /api/translate → test EN→ES with "Hello"
        translate_data = {
            'text': 'Hello',
            'source_lang': 'en',
            'target_lang': 'es'
        }
        result = await self.test_request('POST', '/translate', translate_data)
        if result['status'] == 'PASS' and result['response_data']:
            if 'translated_text' in result['response_data']:
                translated = result['response_data']['translated_text']
                logger.info(f"✅ Translation EN→ES: 'Hello' → '{translated}'")
            else:
                logger.warning("⚠️ Missing 'translated_text' field in response")
        
        # 3. POST /api/tts → test text-to-speech
        tts_data = {
            'text': 'Welcome to Supercharg\'d',
            'language': 'en',
            'voice': 'auto'
        }
        result = await self.test_request('POST', '/tts', tts_data)
        if result['status'] == 'PASS' and result['response_data']:
            if 'audio_base64' in result['response_data']:
                audio_size = len(result['response_data']['audio_base64'])
                voice_used = result['response_data'].get('voice_used', 'unknown')
                logger.info(f"✅ TTS generated audio: {audio_size} chars, voice: {voice_used}")
            else:
                logger.warning("⚠️ Missing 'audio_base64' field in response")
        
        # 4. POST /api/tower-talk → test AI response generation
        tower_talk_data = {
            'situation': 'Customer asking about price negotiation for BMW X5',
            'inquiryType': 'price_question',
            'context': {
                'customerName': 'Alex',
                'vehicle': 'BMW X5',
                'dealershipName': 'Supercharg\'d Motors'
            }
        }
        result = await self.test_request('POST', '/tower-talk', tower_talk_data)
        if result['status'] == 'PASS' and result['response_data']:
            if 'response' in result['response_data']:
                response_text = result['response_data']['response']
                response_length = len(response_text)
                logger.info(f"✅ Tower Talk generated response: {response_length} chars")
                logger.info(f"   Preview: {response_text[:100]}...")
            else:
                logger.warning("⚠️ Missing 'response' field in Tower Talk response")
        
        # 5. GET /api/customers/list → should return customers array
        result = await self.test_request('GET', '/customers/list')
        if result['status'] == 'PASS' and result['response_data']:
            if 'customers' in result['response_data']:
                customer_count = len(result['response_data']['customers'])
                total = result['response_data'].get('total', 'unknown')
                logger.info(f"✅ Customer list returned {customer_count} customers, total: {total}")
            else:
                logger.warning("⚠️ Missing 'customers' field in response")
        
        # 6. GET /api/vin/decode/JM3KKEHA3T1355103 → should return Mazda CX-90 data
        result = await self.test_request('GET', '/vin/decode/JM3KKEHA3T1355103')
        if result['status'] == 'PASS' and result['response_data']:
            if 'make' in result['response_data'] and 'model' in result['response_data']:
                make = result['response_data']['make']
                model = result['response_data']['model']
                year = result['response_data'].get('year', 'unknown')
                logger.info(f"✅ VIN decode success: {year} {make} {model}")
            else:
                logger.warning(f"⚠️ VIN decode response structure: {list(result['response_data'].keys()) if isinstance(result['response_data'], dict) else type(result['response_data'])}")
        
        # 7. GET /api/vin/trade-in-count → should return count structure
        result = await self.test_request('GET', '/vin/trade-in-count')
        if result['status'] == 'PASS' and result['response_data']:
            if 'count' in result['response_data']:
                count = result['response_data']['count']
                cap = result['response_data'].get('cap', 'unknown')
                remaining = result['response_data'].get('remaining', 'unknown')
                logger.info(f"✅ Trade-in count: {count}, cap: {cap}, remaining: {remaining}")
            else:
                logger.warning("⚠️ Missing 'count' field in trade-in response")
        
        # 8. GET /api/dashboard/stats → should return stats
        result = await self.test_request('GET', '/dashboard/stats')
        if result['status'] == 'PASS' and result['response_data']:
            if isinstance(result['response_data'], dict):
                stats_keys = list(result['response_data'].keys())
                logger.info(f"✅ Dashboard stats returned: {len(stats_keys)} metrics")
                logger.info(f"   Available metrics: {stats_keys[:5]}{'...' if len(stats_keys) > 5 else ''}")
            else:
                logger.warning("⚠️ Dashboard stats not in expected dict format")
        
        # 9. POST /api/license/parse-pdf417 → test with valid AAMVA barcode or invalid barcode
        # Test with invalid barcode first
        invalid_barcode_data = {
            'barcode_data': 'invalid_barcode_test_data'
        }
        result = await self.test_request('POST', '/license/parse-pdf417', invalid_barcode_data)
        if result['status'] == 'PASS':
            if result['response_data'] and 'success' in result['response_data']:
                success = result['response_data']['success']
                logger.info(f"✅ License parser handled invalid barcode: success={success}")
            else:
                logger.warning("⚠️ License parser response structure unexpected")
        
        # 10. POST /api/vin/extract-from-image → test with empty base64 (should return 400)
        empty_image_data = {
            'image_base64': ''
        }
        result = await self.test_request('POST', '/vin/extract-from-image', empty_image_data, expected_status=400)
        if result['status'] == 'PASS':
            logger.info("✅ VIN extract correctly rejected empty base64 with 400 status")
        

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
        logger.info("\n" + "=" * 70)
        logger.info("📊 SUPERCHARG'D BACKEND REGRESSION TEST SUMMARY")
        logger.info("=" * 70)
        
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
                    if result['response_data']:
                        logger.info(f"    Response: {str(result['response_data'])[:100]}...")
        
        # Determine quality gate status
        if summary['pass_rate'] >= 90:
            logger.info(f"\n🎉 QUALITY GATE: PASS ({summary['pass_rate']}% ≥ 90% target)")
            return True
        else:
            logger.info(f"\n🚨 QUALITY GATE: FAIL ({summary['pass_rate']}% < 90% target)")
            return False

async def main():
    """Main test execution"""
    try:
        async with BackendRegressionTester() as tester:
            await tester.run_regression_tests()
            summary = tester.generate_summary()
            quality_gate_pass = tester.print_summary(summary)
            
            # Save detailed results to file
            with open('/app/backend_regression_results.json', 'w') as f:
                json.dump(summary, f, indent=2)
            
            logger.info(f"\n📁 Detailed results saved to: /app/backend_regression_results.json")
            
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