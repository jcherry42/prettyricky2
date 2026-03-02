#!/usr/bin/env python3
"""
Comprehensive Backend Test for VIN Scanner Endpoints
Testing VIN decode, trade-in count, and save-to-inventory after overhaul
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
from typing import Dict, Any, List

# Backend URL as specified in review request
BACKEND_URL = "http://localhost:8001"

class VINBackendTester:
    def __init__(self):
        self.backend_url = BACKEND_URL
        self.session = None
        self.test_results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name: str, passed: bool, details: str = "", response_time_ms: float = 0):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "passed": passed,
            "details": details,
            "response_time_ms": round(response_time_ms, 2)
        }
        self.test_results.append(result)
        print(f"{status} {test_name}: {details} ({response_time_ms:.0f}ms)")
        
    async def make_request(self, method: str, endpoint: str, **kwargs) -> tuple:
        """Make HTTP request and measure response time"""
        url = f"{self.backend_url}{endpoint}"
        start_time = datetime.now()
        
        try:
            async with self.session.request(method, url, **kwargs) as response:
                response_time = (datetime.now() - start_time).total_seconds() * 1000
                try:
                    data = await response.json()
                except:
                    data = await response.text()
                return response.status, data, response_time
        except Exception as e:
            response_time = (datetime.now() - start_time).total_seconds() * 1000
            return 0, str(e), response_time
    
    async def test_vin_decode_valid_us_honda(self):
        """Test VIN decode with valid US VIN: 1HGCV1F34LA000001 (Honda Accord)"""
        test_name = "VIN Decode - Valid US Honda"
        vin = "1HGCV1F34LA000001"
        
        status, data, response_time = await self.make_request("GET", f"/api/vin/decode/{vin}")
        
        if status == 200 and isinstance(data, dict):
            required_fields = ["vin", "year", "make", "model", "validation"]
            has_all_fields = all(field in data for field in required_fields)
            
            validation_check = (
                "confidence_score" in data.get("validation", {}) and
                "checksum_valid" in data.get("validation", {})
            )
            
            if has_all_fields and validation_check:
                make = data.get("make", "").upper()
                model = data.get("model", "").upper()
                if "HONDA" in make and "ACCORD" in model:
                    self.log_result(test_name, True, 
                        f"Successfully decoded Honda Accord, confidence: {data['validation'].get('confidence_score', 0)}%", 
                        response_time)
                else:
                    self.log_result(test_name, False, 
                        f"Incorrect vehicle decoded: {data.get('make')} {data.get('model')}", 
                        response_time)
            else:
                missing = [f for f in required_fields if f not in data]
                self.log_result(test_name, False, 
                    f"Missing fields: {missing}, validation check: {validation_check}", 
                    response_time)
        else:
            self.log_result(test_name, False, f"Status {status}, response: {str(data)[:200]}", response_time)
    
    async def test_vin_decode_valid_japanese_mazda(self):
        """Test VIN decode with valid Japanese VIN: JM3KKEHA3T1355103 (Mazda CX-90)"""
        test_name = "VIN Decode - Valid Japanese Mazda"
        vin = "JM3KKEHA3T1355103"
        
        status, data, response_time = await self.make_request("GET", f"/api/vin/decode/{vin}")
        
        if status == 200 and isinstance(data, dict):
            required_fields = ["vin", "year", "make", "model", "validation"]
            has_all_fields = all(field in data for field in required_fields)
            
            validation_check = (
                "confidence_score" in data.get("validation", {}) and
                "checksum_valid" in data.get("validation", {})
            )
            
            if has_all_fields and validation_check:
                make = data.get("make", "").upper()
                model = data.get("model", "").upper()
                if "MAZDA" in make and "CX" in model:
                    self.log_result(test_name, True, 
                        f"Successfully decoded Mazda CX-90, confidence: {data['validation'].get('confidence_score', 0)}%", 
                        response_time)
                else:
                    self.log_result(test_name, False, 
                        f"Incorrect vehicle decoded: {data.get('make')} {data.get('model')}", 
                        response_time)
            else:
                missing = [f for f in required_fields if f not in data]
                self.log_result(test_name, False, 
                    f"Missing fields: {missing}, validation check: {validation_check}", 
                    response_time)
        else:
            self.log_result(test_name, False, f"Status {status}, response: {str(data)[:200]}", response_time)
    
    async def test_vin_decode_invalid_short(self):
        """Test VIN decode with invalid VIN (too short): ABC123"""
        test_name = "VIN Decode - Invalid Short VIN"
        vin = "ABC123"
        
        status, data, response_time = await self.make_request("GET", f"/api/vin/decode/{vin}")
        
        if status == 400:
            self.log_result(test_name, True, "Correctly rejected short VIN with 400 error", response_time)
        else:
            self.log_result(test_name, False, f"Expected 400, got {status}: {str(data)[:200]}", response_time)
    
    async def test_vin_decode_invalid_characters(self):
        """Test VIN decode with invalid characters (I, O, Q): 1HGCV1F34LA00IOQ1"""
        test_name = "VIN Decode - Invalid Characters (I,O,Q)"
        vin = "1HGCV1F34LA00IOQ1"
        
        status, data, response_time = await self.make_request("GET", f"/api/vin/decode/{vin}")
        
        if status == 400:
            self.log_result(test_name, True, "Correctly rejected VIN with invalid characters", response_time)
        else:
            self.log_result(test_name, False, f"Expected 400, got {status}: {str(data)[:200]}", response_time)
    
    async def test_trade_in_count(self):
        """Test trade-in count endpoint - should return count, cap (50), remaining, at_limit"""
        test_name = "Trade-In Count Endpoint"
        
        status, data, response_time = await self.make_request("GET", "/api/vin/trade-in-count")
        
        if status == 200 and isinstance(data, dict):
            required_fields = ["count", "cap", "remaining", "at_limit"]
            has_all_fields = all(field in data for field in required_fields)
            
            if has_all_fields:
                cap = data.get("cap")
                count = data.get("count")
                remaining = data.get("remaining")
                at_limit = data.get("at_limit")
                
                if cap == 50 and isinstance(count, int) and isinstance(remaining, int) and isinstance(at_limit, bool):
                    self.log_result(test_name, True, 
                        f"Count: {count}, Cap: {cap}, Remaining: {remaining}, At limit: {at_limit}", 
                        response_time)
                else:
                    self.log_result(test_name, False, 
                        f"Invalid values - Cap: {cap}, Count: {count}, Remaining: {remaining}, At limit: {at_limit}", 
                        response_time)
            else:
                missing = [f for f in required_fields if f not in data]
                self.log_result(test_name, False, f"Missing fields: {missing}", response_time)
        else:
            self.log_result(test_name, False, f"Status {status}, response: {str(data)[:200]}", response_time)
    
    async def test_save_active_inventory(self):
        """Test saving VIN as active_inventory"""
        test_name = "Save VIN as Active Inventory"
        
        payload = {
            "vin": "1HGCV1F34LA000001",
            "vehicle_data": {
                "year": "2020",
                "make": "HONDA", 
                "model": "Accord"
            },
            "category": "active_inventory"
        }
        
        status, data, response_time = await self.make_request(
            "POST", "/api/vin/save-to-inventory", 
            json=payload
        )
        
        if status in [200, 409]:  # 200 = success, 409 = already exists (acceptable)
            if status == 200:
                if isinstance(data, dict) and "category" in data:
                    self.log_result(test_name, True, 
                        f"Successfully saved to active inventory, category: {data.get('category')}", 
                        response_time)
                else:
                    self.log_result(test_name, False, f"Missing category field in response: {data}", response_time)
            else:  # 409
                self.log_result(test_name, True, "VIN already exists (409) - acceptable for test", response_time)
        else:
            self.log_result(test_name, False, f"Status {status}, response: {str(data)[:200]}", response_time)
    
    async def test_save_trade_in(self):
        """Test saving VIN as trade_in"""
        test_name = "Save VIN as Trade-In"
        
        payload = {
            "vin": "JM3KKEHA3T1355103",
            "vehicle_data": {
                "year": "2026",
                "make": "MAZDA",
                "model": "CX-90"
            },
            "category": "trade_in"
        }
        
        status, data, response_time = await self.make_request(
            "POST", "/api/vin/save-to-inventory", 
            json=payload
        )
        
        if status in [200, 409]:  # 200 = success, 409 = already exists (acceptable) 
            if status == 200:
                if isinstance(data, dict) and "category" in data:
                    self.log_result(test_name, True, 
                        f"Successfully saved as trade-in, category: {data.get('category')}", 
                        response_time)
                else:
                    self.log_result(test_name, False, f"Missing category field in response: {data}", response_time)
            else:  # 409
                self.log_result(test_name, True, "VIN already exists (409) - acceptable for test", response_time)
        else:
            self.log_result(test_name, False, f"Status {status}, response: {str(data)[:200]}", response_time)
    
    async def test_duplicate_vin_rejection(self):
        """Test duplicate VIN rejection - try saving same VIN again, expect 409"""
        test_name = "Duplicate VIN Rejection"
        
        # Try to save the same Honda VIN again
        payload = {
            "vin": "1HGCV1F34LA000001",
            "vehicle_data": {
                "year": "2020",
                "make": "HONDA",
                "model": "Accord"
            },
            "category": "active_inventory"
        }
        
        status, data, response_time = await self.make_request(
            "POST", "/api/vin/save-to-inventory", 
            json=payload
        )
        
        if status == 409:
            self.log_result(test_name, True, "Correctly rejected duplicate VIN with 409 error", response_time)
        else:
            self.log_result(test_name, False, f"Expected 409, got {status}: {str(data)[:200]}", response_time)
    
    async def test_trade_in_count_increase(self):
        """Verify trade-in count increases after trade-in save"""
        test_name = "Trade-In Count Verification"
        
        # Get initial count
        status1, data1, _ = await self.make_request("GET", "/api/vin/trade-in-count")
        
        if status1 != 200:
            self.log_result(test_name, False, f"Failed to get initial count: {status1}", 0)
            return
            
        initial_count = data1.get("count", 0)
        
        # Try to add a new trade-in (use a different VIN)
        payload = {
            "vin": "JM3KKEHA3T1355999",  # Different VIN
            "vehicle_data": {
                "year": "2025",
                "make": "MAZDA",
                "model": "CX-90"
            },
            "category": "trade_in"
        }
        
        status2, data2, response_time = await self.make_request(
            "POST", "/api/vin/save-to-inventory", 
            json=payload
        )
        
        # Get count after save
        status3, data3, _ = await self.make_request("GET", "/api/vin/trade-in-count")
        
        if status3 == 200:
            final_count = data3.get("count", 0)
            
            if status2 == 200:
                # New VIN saved successfully
                if final_count > initial_count:
                    self.log_result(test_name, True, 
                        f"Trade-in count increased from {initial_count} to {final_count}", 
                        response_time)
                else:
                    self.log_result(test_name, False, 
                        f"Count did not increase: {initial_count} -> {final_count}", 
                        response_time)
            elif status2 == 409:
                # VIN already exists, count should remain same
                if final_count == initial_count:
                    self.log_result(test_name, True, 
                        f"Count unchanged ({initial_count}) as expected for duplicate VIN", 
                        response_time)
                else:
                    self.log_result(test_name, False, 
                        f"Count changed unexpectedly: {initial_count} -> {final_count}", 
                        response_time)
            else:
                self.log_result(test_name, False, f"Save failed with status {status2}: {data2}", response_time)
        else:
            self.log_result(test_name, False, f"Failed to get final count: {status3}", response_time)
    
    # Regression Tests
    
    async def test_health_endpoint(self):
        """Test health endpoint regression check"""
        test_name = "Health Endpoint Regression"
        
        status, data, response_time = await self.make_request("GET", "/api/health")
        
        if status == 200:
            self.log_result(test_name, True, "Health endpoint responding correctly", response_time)
        else:
            self.log_result(test_name, False, f"Status {status}, response: {str(data)[:200]}", response_time)
    
    async def test_customers_list_endpoint(self):
        """Test customers list endpoint regression check"""
        test_name = "Customers List Endpoint Regression"
        
        status, data, response_time = await self.make_request("GET", "/api/customers/list?limit=3")
        
        if status == 200 and isinstance(data, dict):
            if "customers" in data and "total" in data:
                self.log_result(test_name, True, 
                    f"Customers list has proper structure, total: {data.get('total')}", 
                    response_time)
            else:
                self.log_result(test_name, False, f"Missing customers or total field: {data.keys()}", response_time)
        else:
            self.log_result(test_name, False, f"Status {status}, response: {str(data)[:200]}", response_time)
    
    async def test_translate_endpoint(self):
        """Test translate endpoint regression check"""
        test_name = "Translate Endpoint Regression"
        
        payload = {
            "text": "Hello",
            "source_lang": "en", 
            "target_lang": "es"
        }
        
        status, data, response_time = await self.make_request(
            "POST", "/api/translate", 
            json=payload
        )
        
        if status == 200 and isinstance(data, dict):
            if "translated_text" in data:
                self.log_result(test_name, True, 
                    f"Translation working: '{payload['text']}' -> '{data.get('translated_text')}'", 
                    response_time)
            else:
                self.log_result(test_name, False, f"Missing translated_text field: {data}", response_time)
        else:
            self.log_result(test_name, False, f"Status {status}, response: {str(data)[:200]}", response_time)
    
    async def cleanup_test_data(self):
        """Clean up test vehicles after testing"""
        test_name = "Cleanup Test Data"
        
        test_vins = ["1HGCV1F34LA000001", "JM3KKEHA3T1355103", "JM3KKEHA3T1355999"]
        
        cleanup_results = []
        for vin in test_vins:
            # Try to delete via API if endpoint exists, otherwise note for manual cleanup
            status, data, response_time = await self.make_request("DELETE", f"/api/vehicles/vin/{vin}")
            
            if status == 200:
                cleanup_results.append(f"✅ {vin}")
            elif status == 404:
                cleanup_results.append(f"➖ {vin} (not found)")
            else:
                cleanup_results.append(f"❌ {vin} (status {status})")
        
        self.log_result(test_name, True, f"Cleanup attempted: {', '.join(cleanup_results)}", 0)
        print(f"\n⚠️  MANUAL CLEANUP REQUIRED: Please delete test vehicles with VINs: {', '.join(test_vins)}")
    
    async def run_all_tests(self):
        """Run all VIN scanner backend tests"""
        print("🚀 Starting Comprehensive VIN Scanner Backend Tests")
        print(f"📡 Backend URL: {self.backend_url}")
        print("=" * 80)
        
        # VIN Decode Tests
        await self.test_vin_decode_valid_us_honda()
        await self.test_vin_decode_valid_japanese_mazda()
        await self.test_vin_decode_invalid_short()
        await self.test_vin_decode_invalid_characters()
        
        # Trade-in Count Tests
        await self.test_trade_in_count()
        
        # Save to Inventory Tests
        await self.test_save_active_inventory()
        await self.test_save_trade_in()
        await self.test_duplicate_vin_rejection()
        await self.test_trade_in_count_increase()
        
        # Regression Tests
        await self.test_health_endpoint()
        await self.test_customers_list_endpoint() 
        await self.test_translate_endpoint()
        
        # Cleanup
        await self.cleanup_test_data()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 80)
        
        passed_tests = [r for r in self.test_results if r["passed"]]
        failed_tests = [r for r in self.test_results if not r["passed"]]
        
        print(f"✅ PASSED: {len(passed_tests)}/{len(self.test_results)} tests")
        print(f"❌ FAILED: {len(failed_tests)}/{len(self.test_results)} tests")
        
        if failed_tests:
            print("\n🔍 FAILED TESTS DETAILS:")
            for test in failed_tests:
                print(f"   ❌ {test['test']}: {test['details']}")
        
        avg_response_time = sum(r["response_time_ms"] for r in self.test_results) / len(self.test_results) if self.test_results else 0
        print(f"\n⏱️  AVERAGE RESPONSE TIME: {avg_response_time:.0f}ms")
        
        # Determine overall result
        success_rate = len(passed_tests) / len(self.test_results) * 100 if self.test_results else 0
        print(f"📈 SUCCESS RATE: {success_rate:.1f}%")
        
        if success_rate >= 90:
            print("🎉 EXCELLENT: VIN Scanner backend is working excellently!")
        elif success_rate >= 75:
            print("👍 GOOD: VIN Scanner backend is working well with minor issues")
        elif success_rate >= 50:
            print("⚠️  MODERATE: VIN Scanner backend has some issues that need attention")
        else:
            print("🚨 CRITICAL: VIN Scanner backend has serious issues requiring immediate attention")
        
        return success_rate >= 75


async def main():
    """Main test execution"""
    try:
        async with VINBackendTester() as tester:
            success = await tester.run_all_tests()
            sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())