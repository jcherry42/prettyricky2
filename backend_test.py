#!/usr/bin/env python3
"""
Backend Test Suite for License Scan Direct Endpoint
Tests the new single-step license scan endpoint and verifies old endpoints still work.
"""

import asyncio
import aiohttp
import json
import sys
import os
from io import BytesIO
from PIL import Image
import base64
from pathlib import Path
import time

# Test configuration
BASE_URL = "http://localhost:8001"
TEST_IMAGE_SIZE = 15 * 1024  # 15KB - above minimum size check (10KB)

class TestResult:
    def __init__(self, name: str):
        self.name = name
        self.success = False
        self.details = ""
        self.response_data = None
        
    def set_success(self, details: str, response_data=None):
        self.success = True
        self.details = details
        self.response_data = response_data
        
    def set_failure(self, details: str, response_data=None):
        self.success = False
        self.details = details
        self.response_data = response_data

async def create_test_image(size_bytes: int = TEST_IMAGE_SIZE) -> bytes:
    """Create a test JPEG image of approximately the specified size"""
    # Start with a reasonable base size that will compress to approximately the target
    base_size = max(200, int((size_bytes / 1000) ** 0.5 * 50))
    
    # Create a sample license-like image with text
    img = Image.new('RGB', (base_size * 4, base_size * 2), color='white')
    
    # Add some noise/patterns to make it compress to desired size
    import random
    pixels = img.load()
    for i in range(0, img.width, 3):
        for j in range(0, img.height, 3):
            pixels[i, j] = (random.randint(200, 255), random.randint(200, 255), random.randint(200, 255))
    
    # Save to bytes
    buffer = BytesIO()
    quality = 85
    
    # Adjust quality to get close to target size
    for _ in range(5):
        buffer.seek(0)
        buffer.truncate()
        img.save(buffer, format='JPEG', quality=quality)
        current_size = len(buffer.getvalue())
        
        if abs(current_size - size_bytes) < size_bytes * 0.2:  # Within 20%
            break
            
        if current_size > size_bytes:
            quality -= 10
        else:
            quality += 5
        
        quality = max(10, min(95, quality))
    
    result = buffer.getvalue()
    print(f"Created test image: {len(result)} bytes (target: {size_bytes})")
    return result

async def test_health_check() -> TestResult:
    """Test GET /api/health endpoint"""
    result = TestResult("Health Check")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BASE_URL}/api/health") as response:
                data = await response.json()
                
                if response.status == 200 and data.get('status') == 'healthy':
                    result.set_success(f"Health check passed: {data.get('status')}", data)
                else:
                    result.set_failure(f"Unexpected health response: {response.status} - {data}")
                    
    except Exception as e:
        result.set_failure(f"Health check failed: {str(e)}")
        
    return result

async def test_license_upload() -> TestResult:
    """Test POST /api/license/upload (old endpoint for regression)"""
    result = TestResult("License Upload (Regression)")
    
    try:
        # Create test image
        image_data = await create_test_image(12 * 1024)  # 12KB
        
        # Create multipart form data
        data = aiohttp.FormData()
        data.add_field('image', image_data, filename='test_license.jpg', content_type='image/jpeg')
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BASE_URL}/api/license/upload", data=data) as response:
                response_data = await response.json()
                
                if response.status == 200 and response_data.get('success'):
                    image_url = response_data.get('image_url')
                    if image_url:
                        result.set_success(f"Upload successful, image URL: {image_url}", response_data)
                    else:
                        result.set_failure("Upload response missing image_url", response_data)
                else:
                    result.set_failure(f"Upload failed: {response.status} - {response_data}", response_data)
                    
    except Exception as e:
        result.set_failure(f"Upload test failed: {str(e)}")
        
    return result

async def test_license_scan_direct() -> TestResult:
    """Test POST /api/license/scan-direct (new endpoint)"""
    result = TestResult("License Scan Direct (New Endpoint)")
    
    try:
        # Create test image that's large enough to pass size checks
        image_data = await create_test_image(TEST_IMAGE_SIZE)
        
        # Create multipart form data with field name 'image'
        data = aiohttp.FormData()
        data.add_field('image', image_data, filename='test_license_direct.jpg', content_type='image/jpeg')
        
        async with aiohttp.ClientSession() as session:
            # Set longer timeout for OCR processing
            timeout = aiohttp.ClientTimeout(total=30)
            async with session.post(f"{BASE_URL}/api/license/scan-direct", data=data, timeout=timeout) as response:
                response_data = await response.json()
                
                print(f"Scan-direct response status: {response.status}")
                print(f"Scan-direct response: {json.dumps(response_data, indent=2)}")
                
                if response.status == 200:
                    # Check required fields in LicenseScanResponse
                    required_fields = ['success', 'image_url']
                    missing_fields = [field for field in required_fields if field not in response_data]
                    
                    if missing_fields:
                        result.set_failure(f"Missing required fields: {missing_fields}", response_data)
                    else:
                        success = response_data.get('success')
                        image_url = response_data.get('image_url')
                        extracted_data = response_data.get('extracted_data')
                        confidence = response_data.get('confidence')
                        error = response_data.get('error')
                        
                        details = f"Status: {response.status}, Success: {success}, Image URL: {image_url}"
                        
                        if success:
                            details += f", Confidence: {confidence}%"
                            if extracted_data:
                                details += f", Extracted data fields: {list(extracted_data.keys())}"
                            result.set_success(details, response_data)
                        else:
                            # Even if OCR fails, it should set image_url and have a clear error message
                            if image_url:
                                details += f", Error: {error}"
                                result.set_success(f"Endpoint works correctly (OCR failed as expected): {details}", response_data)
                            else:
                                result.set_failure(f"Failed without proper error handling: {details}", response_data)
                else:
                    result.set_failure(f"HTTP error: {response.status} - {response_data}", response_data)
                    
    except asyncio.TimeoutError:
        result.set_failure("Request timed out (likely OCR processing issue)")
    except Exception as e:
        result.set_failure(f"Scan-direct test failed: {str(e)}")
        
    return result

async def test_license_scan_direct_small_image() -> TestResult:
    """Test POST /api/license/scan-direct with small image (should fail gracefully)"""
    result = TestResult("License Scan Direct - Small Image Validation")
    
    try:
        # Create very small image (below 5KB threshold)
        small_image = await create_test_image(2 * 1024)  # 2KB
        
        data = aiohttp.FormData()
        data.add_field('image', small_image, filename='small_test.jpg', content_type='image/jpeg')
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BASE_URL}/api/license/scan-direct", data=data) as response:
                response_data = await response.json()
                
                if response.status == 200:
                    success = response_data.get('success')
                    error = response_data.get('error')
                    
                    if not success and error and 'small' in error.lower():
                        result.set_success(f"Small image validation working: {error}", response_data)
                    else:
                        result.set_failure(f"Small image should fail with appropriate error, got: success={success}, error={error}", response_data)
                else:
                    result.set_failure(f"Unexpected HTTP status: {response.status} - {response_data}", response_data)
                    
    except Exception as e:
        result.set_failure(f"Small image test failed: {str(e)}")
        
    return result

async def test_license_scan_direct_empty_image() -> TestResult:
    """Test POST /api/license/scan-direct with empty image (should fail gracefully)"""
    result = TestResult("License Scan Direct - Empty Image Validation")
    
    try:
        # Create empty image
        empty_data = b''
        
        data = aiohttp.FormData()
        data.add_field('image', empty_data, filename='empty.jpg', content_type='image/jpeg')
        
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BASE_URL}/api/license/scan-direct", data=data) as response:
                response_data = await response.json()
                
                if response.status == 200:
                    success = response_data.get('success')
                    error = response_data.get('error')
                    
                    if not success and error and ('empty' in error.lower() or 'file' in error.lower()):
                        result.set_success(f"Empty image validation working: {error}", response_data)
                    else:
                        result.set_failure(f"Empty image should fail with appropriate error, got: success={success}, error={error}", response_data)
                else:
                    result.set_failure(f"Unexpected HTTP status: {response.status} - {response_data}", response_data)
                    
    except Exception as e:
        result.set_failure(f"Empty image test failed: {str(e)}")
        
    return result

def print_results(results: list[TestResult]):
    """Print test results in a clear format"""
    print("\n" + "="*80)
    print("LICENSE SCAN DIRECT ENDPOINT TESTING RESULTS")
    print("="*80)
    
    passed = 0
    failed = 0
    
    for result in results:
        status = "✅ PASS" if result.success else "❌ FAIL"
        print(f"\n{status} - {result.name}")
        print(f"   Details: {result.details}")
        
        if result.success:
            passed += 1
        else:
            failed += 1
            
    print(f"\n" + "="*80)
    print(f"SUMMARY: {passed} PASSED, {failed} FAILED")
    print("="*80)
    
    return passed, failed

async def main():
    """Run all tests"""
    print("Starting License Scan Direct Endpoint Tests...")
    print(f"Base URL: {BASE_URL}")
    
    # List of tests to run
    tests = [
        test_health_check,
        test_license_upload,  # Regression test
        test_license_scan_direct,  # Main new endpoint test
        test_license_scan_direct_small_image,  # Validation test
        test_license_scan_direct_empty_image,  # Edge case test
    ]
    
    results = []
    
    for test_func in tests:
        print(f"\nRunning: {test_func.__name__}...")
        try:
            result = await test_func()
            results.append(result)
            status = "✅" if result.success else "❌"
            print(f"{status} {result.name}: {result.details}")
        except Exception as e:
            error_result = TestResult(test_func.__name__)
            error_result.set_failure(f"Test execution error: {str(e)}")
            results.append(error_result)
            print(f"❌ {test_func.__name__}: Test execution error: {str(e)}")
    
    # Print comprehensive results
    passed, failed = print_results(results)
    
    # Return exit code
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)