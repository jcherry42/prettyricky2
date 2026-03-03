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
                    result['response_data'] = await response.json()
            elif method.upper() == 'POST':
                if isinstance(data, dict):
                    async with self.session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                        result['status_code'] = response.status
                        result['response_data'] = await response.json()
                else:
                    # For form data or other formats
                    async with self.session.post(url, data=data, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
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
        """Run comprehensive backend regression tests"""
        logger.info("🚀 Starting Comprehensive Backend Regression Tests")
        logger.info("=" * 60)
        
        # 1. CRITICAL NEW VIN OCR ENDPOINTS
        logger.info("\n📍 TESTING NEW VIN OCR ENDPOINTS")
        await self.test_vin_extract_from_image_blank()
        await self.test_vin_extract_from_image_with_vin()
        await self.test_vin_extract_empty_validation()
        
        # 2. EXISTING ENDPOINTS REGRESSION TEST
        logger.info("\n📍 TESTING EXISTING ENDPOINTS")
        
        # Health check
        await self.test_request('GET', '/health')
        
        # Customer list
        await self.test_request('GET', '/customers/list?limit=3')
        
        # Translation
        translate_data = {
            'text': 'Hello',
            'source_lang': 'en',
            'target_lang': 'es'
        }
        await self.test_request('POST', '/translate', translate_data)
        
        # Text-to-Speech
        tts_data = {
            'text': 'Welcome',
            'language': 'en'
        }
        await self.test_request('POST', '/tts', tts_data)
        
        # VIN Decode
        await self.test_request('GET', '/vin/decode/JM3KKEHA3T1355103')
        
        # VIN Trade-in Count
        await self.test_request('GET', '/vin/trade-in-count')
        
        # License PDF417 Parse
        pdf417_data = {
            'barcode_data': '@\n\u001e\rANSI 636020090002DL00410278ZK03180026DLDAQK01234567\nDCSPUBLIC\nDDEN\nDACJOHN\nDDFN\nDADNONE\nDDGN\nDCAD\nDCBNONE\nDCDNONE\nDBD01012020\nDBB01011990\nDBA12312025\nDAG123 MAIN ST\nDAILEXINGTON\nDAJKY\nDAK405101234  \nDAQK01234567\nDCF123456789\nDCGUSA\nDAW160\nDAU508\nDAYBRO\nDBA12312025\nDBC1\nDBHN\r'
        }
        await self.test_request('POST', '/license/parse-pdf417', pdf417_data)
        
        # Tower Talk
        tower_talk_data = {
            'situation': 'Customer asking about price',
            'context': {'customer_name': 'John', 'vehicle': 'BMW X5'}
        }
        await self.test_request('POST', '/tower-talk', tower_talk_data)

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