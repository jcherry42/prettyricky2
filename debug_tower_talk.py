#!/usr/bin/env python3

import asyncio
import aiohttp
import json

async def test_tower_talk_sample():
    """Test a single Tower Talk response to debug quality check issues"""
    
    payload = {
        "situation": "Customer texted about 2024 Porsche 911",
        "inquiryType": "new_lead",
        "context": {
            "customerName": "Alex Kim",
            "vehicle": "2024 Porsche 911",
            "dealershipName": "Premier Motorsports",
            "salespersonName": "Jake"
        }
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            'http://localhost:8001/api/tower-talk',
            json=payload,
            headers={'Content-Type': 'application/json'}
        ) as response:
            data = await response.json()
            response_text = data.get('response', '')
            
            print(f"Status: {response.status}")
            print(f"Full Response: '{response_text}'")
            print(f"Length: {len(response_text)} chars")
            
            # Check for the word 'lit'
            if 'lit' in response_text.lower():
                print("❌ Contains 'lit'")
                # Find the context
                words = response_text.split()
                for i, word in enumerate(words):
                    if 'lit' in word.lower():
                        context_start = max(0, i-3)
                        context_end = min(len(words), i+4)
                        context = ' '.join(words[context_start:context_end])
                        print(f"Context around 'lit': '{context}'")
            else:
                print("✅ No 'lit' found")
            
            # Check sign-off
            words = response_text.split()
            last_word = words[-1] if words else ""
            print(f"Last word: '{last_word}'")
            print(f"Last word is alpha: {last_word.isalpha()}")
            print(f"Last word length: {len(last_word)}")

if __name__ == "__main__":
    asyncio.run(test_tower_talk_sample())