#!/usr/bin/env python3
"""
Enhanced Backend Test - License Scan Direct with ML Kit Support
Creates a more realistic test image and verifies ML Kit hint processing
"""

import requests
import os
import io
import sys
from PIL import Image, ImageDraw, ImageFont
import json

# Backend URL configuration
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

def create_realistic_license_image():
    """Create a more realistic driver's license image for testing"""
    # Create a larger image (600x380 pixels, typical license size)
    width, height = 600, 380
    img = Image.new('RGB', (width, height), color='lightblue')
    draw = ImageDraw.Draw(img)
    
    # Try to use a built-in font, fallback to default
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except:
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()
    
    # Add license text elements
    draw.text((20, 20), "DRIVER LICENSE", fill='black', font=font)
    draw.text((20, 50), "CALIFORNIA", fill='black', font=font)
    
    # License number
    draw.text((20, 90), "DL D1234567", fill='black', font=font)
    
    # Expiration
    draw.text((20, 120), "EXP 03/15/2027", fill='black', font=small_font)
    
    # Date of birth
    draw.text((20, 150), "DOB 06/22/1990", fill='black', font=small_font)
    
    # Name
    draw.text((20, 180), "SMITH, JOHN MICHAEL", fill='black', font=font)
    
    # Address
    draw.text((20, 210), "123 MAIN ST", fill='black', font=small_font)
    draw.text((20, 230), "LOS ANGELES CA 90001", fill='black', font=small_font)
    
    # Add some visual elements to make it look more like a license
    draw.rectangle([300, 50, 550, 200], outline='black', width=2)
    draw.text((320, 210), "PHOTO", fill='gray', font=font)
    
    # Convert to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG', quality=85)
    img_bytes.seek(0)
    
    return img_bytes.getvalue()

def test_comprehensive_license_scan():
    """Comprehensive test of license scan with ML Kit support"""
    print("🎯 COMPREHENSIVE LICENSE SCAN TESTING WITH ML KIT SUPPORT")
    print(f"Backend URL: {BACKEND_URL}")
    print("="*80)
    
    # Test 1: Health check
    print("\n1️⃣ Testing Health Check...")
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health Check: {data.get('status')}")
        else:
            print(f"❌ Health Check: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health Check: Error - {str(e)}")
        return False
    
    # Test 2: License scan WITHOUT ML hint
    print("\n2️⃣ Testing License Scan (Image Only)...")
    try:
        image_data = create_realistic_license_image()
        
        files = {
            'image': ('realistic_license.jpg', image_data, 'image/jpeg')
        }
        
        response = requests.post(f"{API_BASE}/license/scan-direct", files=files, timeout=45)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                extracted = data.get('extracted_data', {})
                confidence = data.get('confidence', 0)
                print(f"✅ License Scan (No Hint): Success - Confidence: {confidence}%")
                print(f"   Extracted: {extracted.get('first_name', 'N/A')} {extracted.get('last_name', 'N/A')}")
                print(f"   License #: {extracted.get('license_number', 'N/A')}")
            else:
                error = data.get('error', 'Unknown error')
                print(f"⚠️ License Scan (No Hint): {error}")
        else:
            print(f"❌ License Scan (No Hint): HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ License Scan (No Hint): Error - {str(e)}")
    
    # Test 3: License scan WITH ML hint
    print("\n3️⃣ Testing License Scan (Image + ML Kit Hint)...")
    try:
        image_data = create_realistic_license_image()
        
        # ML Kit text hint matching the image content
        ml_text_hint = """DRIVER LICENSE
CALIFORNIA
DL D1234567
EXP 03/15/2027
DOB 06/22/1990
SMITH, JOHN MICHAEL
123 MAIN ST
LOS ANGELES CA 90001
PHOTO"""
        
        files = {
            'image': ('realistic_license_with_hint.jpg', image_data, 'image/jpeg')
        }
        data = {
            'ml_text_hint': ml_text_hint
        }
        
        print(f"   ML Kit Hint ({len(ml_text_hint)} chars): {ml_text_hint[:50]}...")
        
        response = requests.post(f"{API_BASE}/license/scan-direct", files=files, data=data, timeout=45)
        
        if response.status_code == 200:
            resp_data = response.json()
            if resp_data.get('success'):
                extracted = resp_data.get('extracted_data', {})
                confidence = resp_data.get('confidence', 0)
                print(f"✅ License Scan (With ML Hint): Success - Confidence: {confidence}%")
                print(f"   Extracted: {extracted.get('first_name', 'N/A')} {extracted.get('last_name', 'N/A')}")
                print(f"   License #: {extracted.get('license_number', 'N/A')}")
                print(f"   Address: {extracted.get('address', 'N/A')}")
            else:
                error = resp_data.get('error', 'Unknown error')
                print(f"⚠️ License Scan (With ML Hint): {error}")
        else:
            print(f"❌ License Scan (With ML Hint): HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ License Scan (With ML Hint): Error - {str(e)}")
    
    # Test 4: AI Stats
    print("\n4️⃣ Testing AI Gateway Stats...")
    try:
        response = requests.get(f"{API_BASE}/ai/stats", timeout=10)
        if response.status_code == 200:
            data = response.json()
            
            # Print the stats structure
            print("✅ AI Gateway Stats Retrieved:")
            
            if 'model_routes' in data:
                model_routes = data['model_routes']
                print(f"   📊 Model Routes: {list(model_routes.keys())}")
                if 'license_ocr' in model_routes:
                    print(f"   🎯 license_ocr route configured: {model_routes['license_ocr']}")
            
            if 'features' in data:
                features = data['features']
                print(f"   📈 Feature Usage: {dict(features)}")
                license_calls = features.get('license_ocr', 0)
                print(f"   🔍 license_ocr calls tracked: {license_calls}")
                
            if 'circuit_breakers' in data:
                circuit_breakers = data['circuit_breakers']
                print(f"   🔌 Circuit Breakers: {dict(circuit_breakers)}")
                
            if 'cache' in data:
                cache = data['cache']
                print(f"   💾 Cache Stats: {dict(cache)}")
        else:
            print(f"❌ AI Gateway Stats: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ AI Gateway Stats: Error - {str(e)}")
    
    print("\n" + "="*80)
    print("🏁 COMPREHENSIVE TESTING COMPLETED")
    print("="*80)
    
    # Check backend logs for ML Kit hint processing
    print("\n5️⃣ Checking Backend Logs for ML Kit Processing...")
    try:
        import subprocess
        result = subprocess.run(['tail', '-n', '20', '/var/log/supervisor/backend.err.log'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0 and result.stdout:
            print("📋 Recent Backend Logs:")
            print(result.stdout)
        else:
            print("ℹ️ No recent error logs found")
    except Exception as e:
        print(f"⚠️ Could not check logs: {str(e)}")

if __name__ == "__main__":
    test_comprehensive_license_scan()