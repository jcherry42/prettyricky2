"""
Backend Test Suite for License Scanner Endpoints
Tests the NEW license scanner backend endpoints that were just added.

Test Cases from Review Request:
A-G: POST /api/license/parse-pdf417 (various AAMVA barcode formats)
H: POST /api/license/scan-from-url (non-existent image)
I-K: Regression tests (health, vin, translate)
"""

import asyncio
import aiohttp
import json
import sys
import os

# Backend URL configuration
BACKEND_URL = "http://localhost:8001"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add_result(self, test_name, passed, details=""):
        self.results.append({
            'test': test_name,
            'passed': passed,
            'details': details
        })
        if passed:
            self.passed += 1
            print(f"✅ {test_name}")
        else:
            self.failed += 1
            print(f"❌ {test_name}: {details}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n🎯 TEST SUMMARY: {self.passed}/{total} passed ({(self.passed/total)*100:.1f}% pass rate)")
        if self.failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if not result['passed']:
                    print(f"  - {result['test']}: {result['details']}")

async def test_license_parse_pdf417():
    """Test POST /api/license/parse-pdf417 with various barcode formats"""
    results = TestResults()
    
    async with aiohttp.ClientSession() as session:
        
        # Test Case A: Kentucky v9 barcode (modern format)
        test_case_a = {
            "barcode_data": "@\n\nANSI 636014090002DL00410288ZK03190008DLDAQK12345678\nDCSJOHNSON\nDDEN\nDACMICHAEL\nDADJAMES\nDBD06062019\nDBB01151990\nDBA01152028\nDBC1\nDAU510\nDAYBLU\nDAG123 MAIN STREET\nDAILOUISVILLE\nDAJKY\nDAK402021375\nDCF0123456789\nDCGUSA\n", 
            "scan_source": "camera"
        }
        
        try:
            async with session.post(f"{BACKEND_URL}/api/license/parse-pdf417", 
                                  json=test_case_a) as resp:
                data = await resp.json()
                
                if (resp.status == 200 and 
                    data.get('success') == True and 
                    data.get('extracted_data', {}).get('first_name') == 'Michael' and
                    data.get('extracted_data', {}).get('last_name') == 'Johnson' and
                    data.get('extracted_data', {}).get('state') == 'KY' and
                    data.get('extracted_data', {}).get('license_number') == 'K12345678' and
                    data.get('confidence', 0) >= 90):
                    results.add_result("A) Kentucky v9 barcode", True)
                else:
                    results.add_result("A) Kentucky v9 barcode", False, 
                                     f"Expected success=true, first_name=Michael, last_name=Johnson, state=KY, license_number=K12345678, confidence>=90. Got: success={data.get('success')}, data={data.get('extracted_data', {})}, confidence={data.get('confidence')}")
        except Exception as e:
            results.add_result("A) Kentucky v9 barcode", False, f"Exception: {e}")
        
        # Test Case B: California v9 barcode
        test_case_b = {
            "barcode_data": "@\n\nANSI 636050090002DL00410288ZC03190008DLDAQD1234567\nDCSGARCIA\nDDEN\nDACMARIA\nDADELENA\nDBD03152022\nDBB07041985\nDBA07042029\nDBC2\nDAU504\nDAYBRO\nDAG456 OAK AVENUE APT 12\nDAISAN FRANCISCO\nDAJCA\nDAK941101234\nDCF12345678901234\nDCGUSA\n", 
            "scan_source": "camera"
        }
        
        try:
            async with session.post(f"{BACKEND_URL}/api/license/parse-pdf417", 
                                  json=test_case_b) as resp:
                data = await resp.json()
                
                if (resp.status == 200 and 
                    data.get('success') == True and 
                    data.get('extracted_data', {}).get('first_name') == 'Maria' and
                    data.get('extracted_data', {}).get('last_name') == 'Garcia' and
                    data.get('extracted_data', {}).get('state') == 'CA' and
                    data.get('extracted_data', {}).get('city') == 'San Francisco'):
                    results.add_result("B) California v9 barcode", True)
                else:
                    results.add_result("B) California v9 barcode", False, 
                                     f"Expected success=true, first_name=Maria, last_name=Garcia, state=CA, city=San Francisco. Got: {data.get('extracted_data', {})}")
        except Exception as e:
            results.add_result("B) California v9 barcode", False, f"Exception: {e}")
        
        # Test Case C: Old v1 New York format (DAA combined name)
        test_case_c = {
            "barcode_data": "@\nANSI 636001010002DL00300196DLDAQT123456789\nDAADOE,JANE,MARIE\nDBB03121975\nDBA03122026\nDAG555 ELM STREET\nDAIALBANY\nDAJNY\nDAK122011234\nDBC2\n", 
            "scan_source": "camera"
        }
        
        try:
            async with session.post(f"{BACKEND_URL}/api/license/parse-pdf417", 
                                  json=test_case_c) as resp:
                data = await resp.json()
                
                if (resp.status == 200 and 
                    data.get('success') == True and 
                    data.get('extracted_data', {}).get('first_name') == 'Jane' and
                    data.get('extracted_data', {}).get('middle_name') == 'Marie' and
                    data.get('extracted_data', {}).get('last_name') == 'Doe' and
                    data.get('extracted_data', {}).get('state') == 'NY'):
                    results.add_result("C) Old v1 NY (DAA combined name)", True)
                else:
                    results.add_result("C) Old v1 NY (DAA combined name)", False, 
                                     f"Expected first_name=Jane, middle_name=Marie, last_name=Doe, state=NY. Got: {data.get('extracted_data', {})}")
        except Exception as e:
            results.add_result("C) Old v1 NY (DAA combined name)", False, f"Exception: {e}")
        
        # Test Case D: Texas v8 barcode (city name contains valid code "DAL" in "DALLAS")
        test_case_d = {
            "barcode_data": "@\n\nANSI 636041080002DL00410278ZT03190008DLDAQ12345678\nDCSWILLIAMS\nDACROBERT\nDADLEE\nDBD01012020\nDBB12251988\nDBA12252027\nDBC1\nDAU511\nDAYGRN\nDAG789 SUNSET BLVD\nDAIDALLAS\nDAJTX\nDAK752011234\nDCGUSA\n", 
            "scan_source": "camera"
        }
        
        try:
            async with session.post(f"{BACKEND_URL}/api/license/parse-pdf417", 
                                  json=test_case_d) as resp:
                data = await resp.json()
                
                city = data.get('extracted_data', {}).get('city')
                if (resp.status == 200 and 
                    data.get('success') == True and 
                    data.get('extracted_data', {}).get('first_name') == 'Robert' and
                    data.get('extracted_data', {}).get('last_name') == 'Williams' and
                    data.get('extracted_data', {}).get('state') == 'TX' and
                    city == 'Dallas'):  # City should NOT be empty!
                    results.add_result("D) Texas v8 barcode (Dallas city)", True)
                else:
                    results.add_result("D) Texas v8 barcode (Dallas city)", False, 
                                     f"Expected first_name=Robert, last_name=Williams, state=TX, city=Dallas (NOT empty!). Got: city={city}, data={data.get('extracted_data', {})}")
        except Exception as e:
            results.add_result("D) Texas v8 barcode (Dallas city)", False, f"Exception: {e}")
        
        # Test Case E: Florida barcode
        test_case_e = {
            "barcode_data": "@\n\nANSI 636010090002DL00410288ZF03190008DLDAQJ123-456-78-901-0\nDCSSMITH\nDACJAMES\nDADWILLIAM\nDBD08152023\nDBB02281992\nDBA02282030\nDBC1\nDAU600\nDAYBLU\nDAG1010 OCEAN DRIVE\nDAIMIAMI\nDAJFL\nDAK331391234\nDCGUSA\n", 
            "scan_source": "camera"
        }
        
        try:
            async with session.post(f"{BACKEND_URL}/api/license/parse-pdf417", 
                                  json=test_case_e) as resp:
                data = await resp.json()
                
                if (resp.status == 200 and 
                    data.get('success') == True and 
                    data.get('extracted_data', {}).get('state') == 'FL' and
                    data.get('extracted_data', {}).get('city') == 'Miami' and
                    data.get('extracted_data', {}).get('license_number') == 'J123-456-78-901-0'):
                    results.add_result("E) Florida barcode", True)
                else:
                    results.add_result("E) Florida barcode", False, 
                                     f"Expected state=FL, city=Miami, license_number=J123-456-78-901-0. Got: {data.get('extracted_data', {})}")
        except Exception as e:
            results.add_result("E) Florida barcode", False, f"Exception: {e}")
        
        # Test Case F: Empty/invalid data
        test_case_f = {
            "barcode_data": "hello world", 
            "scan_source": "camera"
        }
        
        try:
            async with session.post(f"{BACKEND_URL}/api/license/parse-pdf417", 
                                  json=test_case_f) as resp:
                data = await resp.json()
                
                if (resp.status == 200 and 
                    data.get('success') == False and
                    data.get('errors') is not None and 
                    len(data.get('errors', [])) > 0):
                    results.add_result("F) Empty/invalid data", True)
                else:
                    results.add_result("F) Empty/invalid data", False, 
                                     f"Expected success=false, errors not empty. Got: {data}")
        except Exception as e:
            results.add_result("F) Empty/invalid data", False, f"Exception: {e}")
        
        # Test Case G: Too short data
        test_case_g = {
            "barcode_data": "abc", 
            "scan_source": "camera"
        }
        
        try:
            async with session.post(f"{BACKEND_URL}/api/license/parse-pdf417", 
                                  json=test_case_g) as resp:
                data = await resp.json()
                
                if (resp.status == 200 and 
                    data.get('success') == False):
                    results.add_result("G) Too short data", True)
                else:
                    results.add_result("G) Too short data", False, 
                                     f"Expected success=false. Got: {data}")
        except Exception as e:
            results.add_result("G) Too short data", False, f"Exception: {e}")
    
    return results

async def test_license_scan_from_url():
    """Test POST /api/license/scan-from-url"""
    results = TestResults()
    
    async with aiohttp.ClientSession() as session:
        
        # Test Case H: Non-existent image
        test_case_h = {
            "image_url": "/api/uploads/nonexistent_abc.jpg", 
            "retry_count": 0
        }
        
        try:
            async with session.post(f"{BACKEND_URL}/api/license/scan-from-url", 
                                  json=test_case_h) as resp:
                data = await resp.json()
                
                if (resp.status == 200 and 
                    data.get('success') == False and
                    'not found' in str(data.get('error', '')).lower()):
                    results.add_result("H) Non-existent image", True)
                else:
                    results.add_result("H) Non-existent image", False, 
                                     f"Expected success=false, error contains 'not found'. Got: {data}")
        except Exception as e:
            results.add_result("H) Non-existent image", False, f"Exception: {e}")
    
    return results

async def test_regression_endpoints():
    """Test existing endpoints still work (regression tests)"""
    results = TestResults()
    
    async with aiohttp.ClientSession() as session:
        
        # Test Case I: GET /api/health
        try:
            async with session.get(f"{BACKEND_URL}/api/health") as resp:
                if resp.status == 200:
                    results.add_result("I) GET /api/health", True)
                else:
                    results.add_result("I) GET /api/health", False, f"Status {resp.status}")
        except Exception as e:
            results.add_result("I) GET /api/health", False, f"Exception: {e}")
        
        # Test Case J: GET /api/vin/trade-in-count
        try:
            async with session.get(f"{BACKEND_URL}/api/vin/trade-in-count") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    # Check proper structure
                    if ('count' in data and 'cap' in data and 'remaining' in data and 'at_limit' in data):
                        results.add_result("J) GET /api/vin/trade-in-count", True)
                    else:
                        results.add_result("J) GET /api/vin/trade-in-count", False, 
                                         f"Missing required fields in structure: {data}")
                else:
                    results.add_result("J) GET /api/vin/trade-in-count", False, f"Status {resp.status}")
        except Exception as e:
            results.add_result("J) GET /api/vin/trade-in-count", False, f"Exception: {e}")
        
        # Test Case K: POST /api/translate
        test_translate = {
            "text": "Hello",
            "source_lang": "en", 
            "target_lang": "es"
        }
        
        try:
            async with session.post(f"{BACKEND_URL}/api/translate", 
                                  json=test_translate) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get('translated_text'):
                        results.add_result("K) POST /api/translate", True)
                    else:
                        results.add_result("K) POST /api/translate", False, 
                                         f"Missing translated_text field: {data}")
                else:
                    results.add_result("K) POST /api/translate", False, f"Status {resp.status}")
        except Exception as e:
            results.add_result("K) POST /api/translate", False, f"Exception: {e}")
    
    return results

async def main():
    print("🎯 LICENSE SCANNER BACKEND ENDPOINTS TESTING")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print()
    
    # Test PDF417 parsing endpoints (test cases A-G)
    print("🔍 Testing POST /api/license/parse-pdf417 (Test Cases A-G)")
    pdf417_results = await test_license_parse_pdf417()
    print()
    
    # Test scan from URL endpoint (test case H)
    print("🔍 Testing POST /api/license/scan-from-url (Test Case H)")
    scan_url_results = await test_license_scan_from_url()
    print()
    
    # Test regression endpoints (test cases I-K)
    print("🔍 Testing Regression Endpoints (Test Cases I-K)")
    regression_results = await test_regression_endpoints()
    print()
    
    # Combine all results
    all_results = TestResults()
    all_results.passed = pdf417_results.passed + scan_url_results.passed + regression_results.passed
    all_results.failed = pdf417_results.failed + scan_url_results.failed + regression_results.failed
    all_results.results = pdf417_results.results + scan_url_results.results + regression_results.results
    
    # Print comprehensive summary
    print("=" * 60)
    all_results.summary()
    print()
    
    # Detailed breakdown
    print("📊 DETAILED BREAKDOWN:")
    print(f"  PDF417 Parsing (A-G): {pdf417_results.passed}/{pdf417_results.passed + pdf417_results.failed}")
    print(f"  Scan from URL (H): {scan_url_results.passed}/{scan_url_results.passed + scan_url_results.failed}")
    print(f"  Regression Tests (I-K): {regression_results.passed}/{regression_results.passed + regression_results.failed}")
    
    if all_results.passed == 11:  # Total expected tests A through K
        print("\n🎉 ALL TESTS PASSED! License scanner backend endpoints are working perfectly.")
    else:
        print(f"\n⚠️  {all_results.failed} test(s) failed. Please check implementation.")
    
    return all_results

if __name__ == "__main__":
    asyncio.run(main())