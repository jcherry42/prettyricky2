#!/usr/bin/env python3
"""
Backend Testing Script for Supercharg'd Tower Talk and Translation Upgrades

Tests the following endpoints that were just upgraded:
1. Tower Talk with new inquiryType field - POST /api/tower-talk
2. Translation with gpt-4o upgrade - POST /api/translate  
3. Health check - GET /api/health

As requested in the review, testing against backend at:
https://pwa-native.preview.emergentagent.com/api
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime
from typing import Dict, Any, List


class BackendTester:
    def __init__(self):
        self.base_url = "https://pwa-native.preview.emergentagent.com/api"
        self.session = None
        self.results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def log_result(self, test_name: str, success: bool, details: str, response_data: Any = None):
        """Log test result with timestamp"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   Details: {details}")
        if response_data:
            print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
        print()
    
    async def test_health_check(self):
        """Test health check endpoint"""
        try:
            start_time = time.time()
            async with self.session.get(f"{self.base_url}/health") as response:
                response_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    self.log_result(
                        "Health Check",
                        True,
                        f"Status: {data.get('status')} - Response time: {response_time:.2f}s",
                        data
                    )
                else:
                    self.log_result(
                        "Health Check", 
                        False,
                        f"HTTP {response.status} - Response time: {response_time:.2f}s"
                    )
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")
    
    async def test_tower_talk_with_inquiry_type(self, inquiry_type: str, situation: str, context: Dict[str, Any]):
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
                    
                    # Validate response quality
                    sentences = response_text.split('. ')
                    sentence_count = len([s for s in sentences if s.strip()])
                    
                    # Check for quality indicators
                    has_brackets = '[' in response_text or ']' in response_text
                    has_placeholders = '{' in response_text or '}' in response_text
                    has_emojis = any(ord(char) > 127 for char in response_text)
                    
                    quality_issues = []
                    if sentence_count < 2 or sentence_count > 4:
                        quality_issues.append(f"Sentence count: {sentence_count} (expected 2-4)")
                    if has_brackets:
                        quality_issues.append("Contains brackets")
                    if has_placeholders:
                        quality_issues.append("Contains placeholders")
                    if has_emojis:
                        quality_issues.append("Contains emojis")
                    
                    success = len(quality_issues) == 0
                    details = f"inquiryType: {inquiry_type}, Response length: {len(response_text)}, Sentences: {sentence_count}, Time: {response_time:.2f}s"
                    if quality_issues:
                        details += f" - Issues: {', '.join(quality_issues)}"
                    
                    self.log_result(
                        f"Tower Talk - {inquiry_type}",
                        success,
                        details,
                        {
                            "inquiry_type": inquiry_type,
                            "situation": situation[:50] + "..." if len(situation) > 50 else situation,
                            "response_length": len(response_text),
                            "sentence_count": sentence_count,
                            "response_preview": response_text[:100] + "..." if len(response_text) > 100 else response_text,
                            "quality_issues": quality_issues,
                            "response_time": f"{response_time:.2f}s"
                        }
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        f"Tower Talk - {inquiry_type}",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}... - Time: {response_time:.2f}s"
                    )
                    
        except Exception as e:
            self.log_result(f"Tower Talk - {inquiry_type}", False, f"Exception: {str(e)}")
    
    async def test_tower_talk_backwards_compatibility(self):
        """Test Tower Talk without inquiryType field for backwards compatibility"""
        try:
            start_time = time.time()
            
            payload = {
                "situation": "Customer texting asking about our 2024 Tesla Model 3 inventory",
                "context": {
                    "customerName": "Mike Chen",
                    "vehicle": "2024 Tesla Model 3",
                    "dealershipName": "Premier Auto",
                    "salespersonName": "Jake"
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
                        "Tower Talk - Backwards Compatibility (no inquiryType)",
                        True,
                        f"Response length: {len(response_text)}, Time: {response_time:.2f}s",
                        {
                            "response_length": len(response_text),
                            "response_preview": response_text[:100] + "..." if len(response_text) > 100 else response_text,
                            "response_time": f"{response_time:.2f}s"
                        }
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        "Tower Talk - Backwards Compatibility",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}... - Time: {response_time:.2f}s"
                    )
                    
        except Exception as e:
            self.log_result("Tower Talk - Backwards Compatibility", False, f"Exception: {str(e)}")
    
    async def test_translation(self, source_lang: str, target_lang: str, text: str, test_name: str):
        """Test translation endpoint with gpt-4o upgrade"""
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
                    
                    # Check if translation looks automotive-appropriate
                    automotive_terms = ["vehicle", "car", "drive", "price", "warranty", "financing", "trade", "appraise"]
                    has_automotive_context = any(term in text.lower() or term in translated_text.lower() for term in automotive_terms)
                    
                    self.log_result(
                        f"Translation - {test_name}",
                        True,
                        f"{source_lang}→{target_lang}, Length: {len(translated_text)}, Time: {response_time:.2f}s, Automotive context: {has_automotive_context}",
                        {
                            "source_lang": source_lang,
                            "target_lang": target_lang,
                            "original": text[:50] + "..." if len(text) > 50 else text,
                            "translated": translated_text[:50] + "..." if len(translated_text) > 50 else translated_text,
                            "detected_lang": detected_lang,
                            "confidence": confidence,
                            "automotive_context": has_automotive_context,
                            "response_time": f"{response_time:.2f}s"
                        }
                    )
                else:
                    error_text = await response.text()
                    self.log_result(
                        f"Translation - {test_name}",
                        False,
                        f"HTTP {response.status} - {error_text[:100]}... - Time: {response_time:.2f}s"
                    )
                    
        except Exception as e:
            self.log_result(f"Translation - {test_name}", False, f"Exception: {str(e)}")
    
    async def run_all_tests(self):
        """Run all requested tests from the review"""
        print("🚀 Starting Comprehensive Backend Testing for Tower Talk & Translation Upgrades")
        print(f"Backend URL: {self.base_url}")
        print("=" * 80)
        print()
        
        # 1. Health Check
        await self.test_health_check()
        
        # 2. Tower Talk with NEW inquiryType field - All requested scenarios
        print("Testing Tower Talk with NEW inquiryType field...")
        
        await self.test_tower_talk_with_inquiry_type(
            "new_lead",
            "Customer texted asking about our 2024 Tesla Model 3 inventory",
            {
                "customerName": "Mike Chen",
                "vehicle": "2024 Tesla Model 3",
                "dealershipName": "Premier Auto",
                "salespersonName": "Jake"
            }
        )
        
        await self.test_tower_talk_with_inquiry_type(
            "price_question",
            "Customer asking why the price is higher than another dealer",
            {
                "customerName": "Sarah",
                "vehicle": "2023 BMW M3",
                "vehiclePrice": "$65,000"
            }
        )
        
        await self.test_tower_talk_with_inquiry_type(
            "trade_in",
            "Customer wants to trade in her 2019 Honda Civic",
            {
                "customerName": "Lisa",
                "vehicle": "2024 Mazda CX-5",
                "tradeVin": "1HGBH41JXMN109186",
                "tradeMileage": "55000"
            }
        )
        
        await self.test_tower_talk_with_inquiry_type(
            "test_drive",
            "Customer wants to schedule a test drive this weekend",
            {
                "customerName": "Tom"
            }
        )
        
        # Test backwards compatibility
        await self.test_tower_talk_backwards_compatibility()
        
        # 3. Translation with gpt-4o upgrade - All requested language pairs
        print("Testing Translation with gpt-4o upgrade...")
        
        await self.test_translation(
            "en", "es",
            "The 2024 BMW X5 is priced at $65,000 and includes a 4-year warranty. When can you come in for a test drive?",
            "EN→ES BMW X5 Warranty"
        )
        
        await self.test_translation(
            "en", "ko",
            "We have financing available with rates as low as 2.9% APR. Come in today to lock in this rate.",
            "EN→KO Financing Rate"
        )
        
        await self.test_translation(
            "en", "fr",
            "Your trade-in has been appraised at $18,500 which is $2,000 above book value.",
            "EN→FR Trade-in Appraisal"
        )
        
        await self.test_translation(
            "en", "ja",
            "The vehicle is available for immediate delivery. I'll have it detailed and ready when you arrive.",
            "EN→JA Immediate Delivery"
        )
        
        # Summary
        print("=" * 80)
        print("🏁 TESTING COMPLETE")
        print("=" * 80)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"  • {result['test']}: {result['details']}")
        
        print("\n📊 QUALITY ASSESSMENT:")
        
        # Tower Talk Quality Assessment
        tower_talk_results = [r for r in self.results if "Tower Talk" in r["test"] and r["success"]]
        if tower_talk_results:
            print("\n🗣️  Tower Talk Response Quality:")
            for result in tower_talk_results:
                if result.get("response_data", {}).get("response_preview"):
                    print(f"  • {result['test']}: '{result['response_data']['response_preview']}'")
        
        # Translation Quality Assessment  
        translation_results = [r for r in self.results if "Translation" in r["test"] and r["success"]]
        if translation_results:
            print("\n🌐 Translation Quality:")
            for result in translation_results:
                rd = result.get("response_data", {})
                if rd.get("translated"):
                    automotive = "✅" if rd.get("automotive_context") else "⚠️"
                    print(f"  • {result['test']}: '{rd.get('original', '')}' → '{rd.get('translated', '')}' {automotive}")
        
        # Save detailed results
        with open('/app/tower_talk_translation_test_results.json', 'w') as f:
            json.dump({
                "test_type": "tower_talk_translation_upgrade",
                "timestamp": datetime.now().isoformat(),
                "backend_url": self.base_url,
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": failed_tests,
                "success_rate": f"{(passed_tests/total_tests)*100:.1f}%",
                "detailed_results": self.results
            }, f, indent=2)
        
        print(f"\n📄 Detailed results saved to: /app/tower_talk_translation_test_results.json")
        
        return passed_tests, failed_tests


async def main():
    async with BackendTester() as tester:
        await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())