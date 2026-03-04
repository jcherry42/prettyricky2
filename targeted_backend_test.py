#!/usr/bin/env python3
"""
Targeted Backend Test for Supercharg'd Automotive Sales Mobile App
Testing the exact endpoints specified in the review request
"""

import asyncio
import aiohttp
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TargetedBackendTester:
    def __init__(self, base_url: str = "https://ios-android-polish.preview.emergentagent.com"):
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
                    result['response_data'] = await response.json()
            elif method.upper() == 'POST':
                async with self.session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                    result['status_code'] = response.status
                    result['response_data'] = await response.json()
            
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

    async def run_targeted_tests(self):
        """Run the exact tests specified in the review request"""
        logger.info("🎯 Starting Targeted Backend Tests for Supercharg'd Mobile App")
        logger.info("=" * 70)
        
        # 1. Health check: GET /api/health
        logger.info("\n📍 1. HEALTH CHECK")
        health_result = await self.test_request('GET', '/health')
        if health_result['status'] == 'PASS':
            logger.info(f"   Status: {health_result['response_data'].get('status')}")
        
        # 2. Translation service (CRITICAL - was returning 404s)
        logger.info("\n📍 2. TRANSLATION SERVICE (CRITICAL)")
        
        # Test case 1: EN->ES
        translate_1 = await self.test_request('POST', '/translate', {
            "text": "Hello friend",
            "source_lang": "en", 
            "target_lang": "es"
        })
        if translate_1['status'] == 'PASS':
            translated_text = translate_1['response_data'].get('translated_text')
            logger.info(f"   EN->ES: 'Hello friend' → '{translated_text}'")
        
        # Test case 2: EN->FR
        translate_2 = await self.test_request('POST', '/translate', {
            "text": "Would you like a test drive?",
            "source_lang": "en",
            "target_lang": "fr"
        })
        if translate_2['status'] == 'PASS':
            translated_text = translate_2['response_data'].get('translated_text')
            logger.info(f"   EN->FR: 'Would you like a test drive?' → '{translated_text}'")
        
        # Test case 3: EN->KO
        translate_3 = await self.test_request('POST', '/translate', {
            "text": "The financing terms are very flexible",
            "source_lang": "en",
            "target_lang": "ko"
        })
        if translate_3['status'] == 'PASS':
            translated_text = translate_3['response_data'].get('translated_text')
            logger.info(f"   EN->KO: 'The financing terms are very flexible' → '{translated_text}'")
        
        # Test case 4: Empty text validation
        translate_4 = await self.test_request('POST', '/translate', {
            "text": "",
            "source_lang": "en",
            "target_lang": "es"
        }, expected_status=400)
        if translate_4['status'] == 'PASS':
            logger.info("   Empty text validation: Correctly returned 400")
        
        # 3. TTS: POST /api/tts
        logger.info("\n📍 3. TEXT-TO-SPEECH")
        tts_result = await self.test_request('POST', '/tts', {
            "text": "Welcome",
            "language": "en",
            "voice": "auto"
        })
        if tts_result['status'] == 'PASS':
            audio_length = len(tts_result['response_data'].get('audio_base64', ''))
            logger.info(f"   Audio generated: {audio_length} chars base64")
        
        # 4. Tower Talk AI: POST /api/tower-talk
        logger.info("\n📍 4. TOWER TALK AI")
        tower_talk_result = await self.test_request('POST', '/tower-talk', {
            "situation": "Customer asking about price",
            "inquiryType": "price_question",
            "context": {
                "customerName": "Alex",
                "vehicle": "2025 GLE 450",
                "dealershipName": "Mercedes-Benz"
            }
        })
        if tower_talk_result['status'] == 'PASS':
            response_length = len(tower_talk_result['response_data'].get('response', ''))
            logger.info(f"   AI response generated: {response_length} chars")
        
        # 5. Customer CRUD: GET /api/customers/list?limit=5
        logger.info("\n📍 5. CUSTOMER CRUD OPERATIONS")
        customers_list = await self.test_request('GET', '/customers/list?limit=5')
        if customers_list['status'] == 'PASS':
            customer_count = customers_list['response_data'].get('total', 0)
            logger.info(f"   Customer list: {customer_count} total customers")
        
        # Test customer creation
        test_customer_data = {
            "first_name": "Alex",
            "last_name": "Martinez",
            "email": "alex.martinez@email.com",
            "phone": "555-0123",
            "status": "new",
            "vehicle_interest": "2025 GLE 450"
        }
        customer_create = await self.test_request('POST', '/customers/create', test_customer_data, expected_status=201)
        customer_id = None
        if customer_create['status'] == 'PASS':
            customer_id = customer_create['response_data'].get('customer_id') or customer_create['response_data'].get('id')
            logger.info(f"   Customer created with ID: {customer_id}")
        
        # Test individual customer retrieval
        if customer_id:
            customer_get = await self.test_request('GET', f'/customers/{customer_id}')
            if customer_get['status'] == 'PASS':
                logger.info(f"   Customer retrieved: {customer_get['response_data'].get('first_name')} {customer_get['response_data'].get('last_name')}")
        
        # Test customer deletion
        if customer_id:
            customer_delete = await self.test_request('DELETE', f'/customers/{customer_id}')
            if customer_delete['status'] == 'PASS':
                logger.info(f"   Customer deleted successfully")
        
        # 6. VIN decode: GET /api/vin/decode/JM3KKEHA3T1355103
        logger.info("\n📍 6. VIN DECODE")
        vin_decode = await self.test_request('GET', '/vin/decode/JM3KKEHA3T1355103')
        if vin_decode['status'] == 'PASS':
            vin_data = vin_decode['response_data']
            logger.info(f"   VIN decoded: {vin_data.get('year')} {vin_data.get('make')} {vin_data.get('model')}")
            confidence = vin_data.get('validation', {}).get('confidence_score', 0)
            logger.info(f"   Confidence: {confidence}%")
        
        # 7. VIN trade-in count: GET /api/vin/trade-in-count
        logger.info("\n📍 7. VIN TRADE-IN COUNT")
        trade_in_count = await self.test_request('GET', '/vin/trade-in-count')
        if trade_in_count['status'] == 'PASS':
            count_data = trade_in_count['response_data']
            logger.info(f"   Trade-in count: {count_data.get('count')}/{count_data.get('cap')}")
            logger.info(f"   Remaining capacity: {count_data.get('remaining')}")

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
        logger.info("📊 TARGETED BACKEND TEST SUMMARY")
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
        async with TargetedBackendTester() as tester:
            await tester.run_targeted_tests()
            summary = tester.generate_summary()
            quality_gate_pass = tester.print_summary(summary)
            
            # Save detailed results to file
            with open('/app/targeted_backend_test_results.json', 'w') as f:
                json.dump(summary, f, indent=2)
            
            logger.info(f"\n📁 Detailed results saved to: /app/targeted_backend_test_results.json")
            
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