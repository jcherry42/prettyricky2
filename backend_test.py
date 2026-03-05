#!/usr/bin/env python3
"""
Driver's License Scanning Backend Pipeline End-to-End Test
Tests the complete license scanning workflow as requested in the review.
"""

import requests
import json
import io
from PIL import Image, ImageDraw, ImageFont
import os
import time

# Use the configured backend URL from frontend/.env
BACKEND_URL = "https://scanner-elite.preview.emergentagent.com"

class Colors:
    """ANSI color codes for terminal output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

def log(message, color=None):
    """Print colored log message"""
    if color:
        print(f"{color}{message}{Colors.RESET}")
    else:
        print(message)

def create_test_license_image():
    """
    Create a realistic test JPEG image that looks like a driver's license
    This ensures we have a proper test image for the OCR pipeline
    """
    # Create base image (license card size ratio)
    width, height = 400, 250
    img = Image.new('RGB', (width, height), color=(245, 245, 220))  # Beige background
    draw = ImageDraw.Draw(img)
    
    try:
        # Try to use a default font (this may fail in some environments)
        font = ImageFont.load_default()
    except:
        font = None
    
    # Add some realistic license-like text
    draw.rectangle([10, 10, width-10, height-10], outline=(100, 100, 100), width=2)
    
    # Add mock license data
    if font:
        draw.text((20, 30), "CALIFORNIA DRIVER LICENSE", fill=(0, 0, 0), font=font)
        draw.text((20, 60), "Name: JOHN QUINCY DOE", fill=(0, 0, 0), font=font)
        draw.text((20, 80), "Address: 123 MAIN ST", fill=(0, 0, 0), font=font)
        draw.text((20, 100), "ANYTOWN, CA 90210", fill=(0, 0, 0), font=font)
        draw.text((20, 130), "DL: D12345678", fill=(0, 0, 0), font=font)
        draw.text((20, 150), "DOB: 01/15/2000", fill=(0, 0, 0), font=font)
        draw.text((20, 170), "EXP: 01/15/2028", fill=(0, 0, 0), font=font)
    
    # Convert to JPEG bytes
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    return buffer.getvalue()

def test_health_check():
    """Test 1: Health Check - GET /api/health"""
    log("\n🔍 TEST 1: Health Check", Colors.CYAN)
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "healthy":
                log("✅ Health check passed", Colors.GREEN)
                return True
            else:
                log(f"❌ Health check failed - status: {data.get('status')}", Colors.RED)
                return False
        else:
            log(f"❌ Health check failed - HTTP {response.status_code}", Colors.RED)
            return False
            
    except Exception as e:
        log(f"❌ Health check error: {str(e)}", Colors.RED)
        return False

def test_single_file_upload():
    """Test 2: Single File Upload - POST /api/license/upload"""
    log("\n🔍 TEST 2: Single File Upload", Colors.CYAN)
    
    try:
        # Create test JPEG image
        image_data = create_test_license_image()
        log(f"   Created test JPEG image: {len(image_data)} bytes")
        
        # Upload with field name "image" as specified
        files = {
            'image': ('test_license.jpg', image_data, 'image/jpeg')
        }
        
        response = requests.post(f"{BACKEND_URL}/api/license/upload", files=files, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "image_url" in data:
                image_url = data["image_url"]
                log(f"✅ File upload successful - URL: {image_url}", Colors.GREEN)
                return image_url
            else:
                log(f"❌ Upload failed - response: {data}", Colors.RED)
                return None
        else:
            log(f"❌ Upload failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return None
            
    except Exception as e:
        log(f"❌ Upload error: {str(e)}", Colors.RED)
        return None

def test_ai_ocr_scan(image_url):
    """Test 3: AI OCR Scan - POST /api/license/scan-from-url"""
    log("\n🔍 TEST 3: AI OCR Scan (OpenAI Vision)", Colors.CYAN)
    
    if not image_url:
        log("❌ Skipping OCR test - no image URL from upload", Colors.RED)
        return None
    
    try:
        payload = {
            "image_url": image_url
        }
        
        log("   Calling OpenAI Vision API (30s timeout)...")
        response = requests.post(
            f"{BACKEND_URL}/api/license/scan-from-url", 
            json=payload, 
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "extracted_data" in data:
                extracted_data = data["extracted_data"]
                log("✅ OCR extraction successful", Colors.GREEN)
                log(f"   Extracted fields: {list(extracted_data.keys())}")
                
                # Show extracted data
                for key, value in extracted_data.items():
                    if value:
                        log(f"   {key}: {value}")
                
                confidence = data.get("confidence", 0)
                log(f"   Confidence: {confidence}%")
                
                return extracted_data
            else:
                log(f"❌ OCR failed - response: {data}", Colors.RED)
                error = data.get("error", "Unknown error")
                log(f"   Error: {error}", Colors.YELLOW)
                return None
        else:
            log(f"❌ OCR request failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return None
            
    except Exception as e:
        log(f"❌ OCR error: {str(e)}", Colors.RED)
        return None

def test_pdf417_barcode_parse():
    """Test 4: PDF417 Barcode Parse - POST /api/license/parse-pdf417"""
    log("\n🔍 TEST 4: PDF417 Barcode Parse", Colors.CYAN)
    
    # Sample AAMVA PDF417 barcode data (from review request)
    sample_barcode = """@

ANSI 636000090002DL00410288ZN03200024DLDAQD12345678
DCSDOE
DDEN
DACJOHN
DDFN
DADQUINCY
DDGN
DBB01152000
DBA01152028
DBCM
DAYBRO
DAU510
DAG123 MAIN ST
DAIANYTOWN
DAJCA
DAK90210    
DCF1234567890
DCGUSA
DAW150"""
    
    try:
        payload = {
            "barcode_data": sample_barcode
        }
        
        response = requests.post(
            f"{BACKEND_URL}/api/license/parse-pdf417", 
            json=payload, 
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "extracted_data" in data:
                extracted_data = data["extracted_data"]
                log("✅ PDF417 parse successful", Colors.GREEN)
                
                # Show parsed data
                for key, value in extracted_data.items():
                    if value:
                        log(f"   {key}: {value}")
                
                confidence = data.get("confidence", 0)
                aamva_version = data.get("aamva_version")
                log(f"   Confidence: {confidence}%")
                log(f"   AAMVA Version: {aamva_version}")
                
                return extracted_data
            else:
                log(f"❌ PDF417 parse failed - response: {data}", Colors.RED)
                errors = data.get("errors", [])
                for error in errors:
                    log(f"   Error: {error}", Colors.YELLOW)
                return None
        else:
            log(f"❌ PDF417 request failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return None
            
    except Exception as e:
        log(f"❌ PDF417 parse error: {str(e)}", Colors.RED)
        return None

def test_create_customer():
    """Test 5: Create Customer - POST /api/customers/create"""
    log("\n🔍 TEST 5: Create Customer from Scan Data", Colors.CYAN)
    
    # Use sample customer data from review request
    customer_data = {
        "first_name": "TestDL",
        "last_name": "Scanner",
        "phone": "",
        "email": "",
        "address": "123 Main St, Anytown, CA, 90210",
        "lead_status": "new",
        "notes": "License #: D12345678"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/customers/create", 
            json=customer_data, 
            timeout=15
        )
        
        if response.status_code in [200, 201]:
            data = response.json()
            if data.get("success") and "customer" in data:
                customer = data["customer"]
                log("✅ Customer created successfully", Colors.GREEN)
                log(f"   Customer ID: {customer.get('id')}")
                log(f"   Name: {customer.get('first_name')} {customer.get('last_name')}")
                log(f"   Address: {customer.get('address')}")
                log(f"   Lead Status: {customer.get('lead_status')}")
                log(f"   Notes: {customer.get('notes')}")
                
                return customer.get("id")
            else:
                log(f"❌ Customer creation failed - response: {data}", Colors.RED)
                return None
        else:
            log(f"❌ Customer creation failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return None
            
    except Exception as e:
        log(f"❌ Customer creation error: {str(e)}", Colors.RED)
        return None

def cleanup_test_data(customer_id=None):
    """Clean up test data - delete test customers"""
    log("\n🧹 CLEANUP: Removing Test Data", Colors.CYAN)
    
    try:
        # Search for test customers with first_name "TestDL"
        search_response = requests.get(
            f"{BACKEND_URL}/api/customers/list?search=TestDL", 
            timeout=10
        )
        
        if search_response.status_code == 200:
            data = search_response.json()
            customers = data.get("customers", [])
            deleted_count = 0
            
            for customer in customers:
                if customer.get("first_name") == "TestDL":
                    customer_id = customer.get("id")
                    if customer_id:
                        delete_response = requests.delete(
                            f"{BACKEND_URL}/api/customers/{customer_id}",
                            timeout=10
                        )
                        if delete_response.status_code in [200, 204]:
                            deleted_count += 1
                            log(f"   Deleted customer: {customer.get('first_name')} {customer.get('last_name')}")
            
            if deleted_count > 0:
                log(f"✅ Cleaned up {deleted_count} test customer(s)", Colors.GREEN)
            else:
                log("   No test customers found to clean up", Colors.YELLOW)
        else:
            log(f"⚠️ Cleanup search failed - HTTP {search_response.status_code}", Colors.YELLOW)
            
    except Exception as e:
        log(f"⚠️ Cleanup error: {str(e)}", Colors.YELLOW)

def run_full_pipeline_test():
    """Run the complete driver's license scanning pipeline test"""
    log("=" * 60, Colors.BOLD)
    log("🚀 DRIVER'S LICENSE SCANNING PIPELINE TEST", Colors.BOLD)
    log("=" * 60, Colors.BOLD)
    
    results = {}
    customer_id = None
    
    # Test 1: Health Check
    results["health"] = test_health_check()
    
    # Test 2: Single File Upload
    image_url = test_single_file_upload()
    results["upload"] = image_url is not None
    
    # Test 3: AI OCR Scan
    extracted_data = test_ai_ocr_scan(image_url)
    results["ocr"] = extracted_data is not None
    
    # Test 4: PDF417 Barcode Parse
    pdf417_data = test_pdf417_barcode_parse()
    results["pdf417"] = pdf417_data is not None
    
    # Test 5: Create Customer
    customer_id = test_create_customer()
    results["customer"] = customer_id is not None
    
    # Cleanup
    cleanup_test_data(customer_id)
    
    # Summary
    log("\n" + "=" * 60, Colors.BOLD)
    log("📊 TEST RESULTS SUMMARY", Colors.BOLD)
    log("=" * 60, Colors.BOLD)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        color = Colors.GREEN if passed else Colors.RED
        log(f"   {test_name.upper()}: {status}", color)
    
    success_rate = (passed_tests / total_tests) * 100
    log(f"\n🎯 SUCCESS RATE: {passed_tests}/{total_tests} ({success_rate:.1f}%)", 
        Colors.GREEN if success_rate >= 80 else Colors.YELLOW if success_rate >= 60 else Colors.RED)
    
    if success_rate == 100:
        log("🎉 ALL TESTS PASSED! License scanning pipeline is working perfectly.", Colors.GREEN)
    elif success_rate >= 80:
        log("✅ Pipeline is mostly functional with minor issues.", Colors.YELLOW)
    else:
        log("❌ Pipeline has critical issues that need attention.", Colors.RED)
    
    return results

if __name__ == "__main__":
    run_full_pipeline_test()