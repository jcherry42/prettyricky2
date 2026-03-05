#!/usr/bin/env python3
"""
Vehicle Inventory Backend API Test
Tests the critical vehicle inventory endpoints as specified in the review request.

This is critical: the IntakeScreen now reads inventory from this API via InventoryContext. 
Any failure here means the Intake tab shows no vehicles.

Test Endpoints:
1. GET /api/vehicles/inventory - Should return { vehicles: [...], counts: { active_inventory, trade_in, total } }
2. POST /api/vin/save-to-inventory - Test saving a vehicle to inventory
3. GET /api/vehicles/inventory (again) - After saving, verify the vehicle appears
4. PATCH /api/vehicles/{id} - Update the vehicle 
5. GET /api/vehicles/inventory - Verify the update persisted
6. DELETE /api/vehicles/{id} - Delete the test vehicle
7. GET /api/vehicles/inventory - Verify the vehicle is gone
"""

import requests
import json
import time

# Use localhost for testing as backend is running on port 8001
BACKEND_URL = "http://localhost:8001"

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

def test_get_inventory_initial():
    """Test 1: GET /api/vehicles/inventory - Initial check"""
    log("\n🔍 TEST 1: Initial Inventory Check", Colors.CYAN)
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/vehicles/inventory", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "vehicles" in data and "counts" in data:
                counts = data.get("counts", {})
                log(f"✅ Initial inventory loaded successfully", Colors.GREEN)
                log(f"   Vehicles: {len(data['vehicles'])}")
                log(f"   Active Inventory: {counts.get('active_inventory', 0)}")
                log(f"   Trade-in: {counts.get('trade_in', 0)}")
                log(f"   Total: {counts.get('total', 0)}")
                return data
            else:
                log(f"❌ Invalid inventory structure: {data}", Colors.RED)
                return None
        else:
            log(f"❌ Inventory request failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return None
            
    except Exception as e:
        log(f"❌ Inventory request error: {str(e)}", Colors.RED)
        return None

def test_save_to_inventory():
    """Test 2: POST /api/vin/save-to-inventory - Save test vehicle"""
    log("\n🔍 TEST 2: Save Vehicle to Inventory", Colors.CYAN)
    
    test_vehicle = {
        "vin": "TEST12345678901234",
        "vehicle_data": {
            "year": 2024,
            "make": "BMW",
            "model": "M5",
            "trim": "Competition"
        },
        "category": "active_inventory"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/vin/save-to-inventory", 
            json=test_vehicle,
            timeout=15
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and "id" in data:
                vehicle_id = data["id"]
                log(f"✅ Vehicle saved successfully", Colors.GREEN)
                log(f"   Vehicle ID: {vehicle_id}")
                log(f"   Category: {data.get('category')}")
                log(f"   Message: {data.get('message')}")
                return vehicle_id
            else:
                log(f"❌ Vehicle save failed - response: {data}", Colors.RED)
                return None
        else:
            log(f"❌ Vehicle save failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return None
            
    except Exception as e:
        log(f"❌ Vehicle save error: {str(e)}", Colors.RED)
        return None

def test_get_inventory_after_save(expected_vehicle_id):
    """Test 3: GET /api/vehicles/inventory - Verify vehicle appears after save"""
    log("\n🔍 TEST 3: Verify Vehicle in Inventory After Save", Colors.CYAN)
    
    if not expected_vehicle_id:
        log("❌ Skipping verification test - no vehicle ID from save", Colors.RED)
        return None
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/vehicles/inventory", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            vehicles = data.get("vehicles", [])
            counts = data.get("counts", {})
            
            # Find our test vehicle
            test_vehicle = None
            for vehicle in vehicles:
                if vehicle.get("id") == expected_vehicle_id:
                    test_vehicle = vehicle
                    break
            
            if test_vehicle:
                log(f"✅ Vehicle found in inventory", Colors.GREEN)
                log(f"   ID: {test_vehicle.get('id')}")
                log(f"   VIN: {test_vehicle.get('vin')}")
                log(f"   Year: {test_vehicle.get('year')}")
                log(f"   Make: {test_vehicle.get('make')}")
                log(f"   Model: {test_vehicle.get('model')}")
                log(f"   Trim: {test_vehicle.get('trim')}")
                log(f"   Category: {test_vehicle.get('category')}")
                log(f"   Status: {test_vehicle.get('status')}")
                log(f"   Created At: {test_vehicle.get('created_at')}")
                
                # Verify counts updated
                log(f"   Updated Counts - Active: {counts.get('active_inventory')}, Trade-in: {counts.get('trade_in')}, Total: {counts.get('total')}")
                
                return test_vehicle
            else:
                log(f"❌ Vehicle not found in inventory (ID: {expected_vehicle_id})", Colors.RED)
                log(f"   Total vehicles in inventory: {len(vehicles)}")
                return None
        else:
            log(f"❌ Inventory request failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return None
            
    except Exception as e:
        log(f"❌ Inventory verification error: {str(e)}", Colors.RED)
        return None

def test_update_vehicle(vehicle_id):
    """Test 4: PATCH /api/vehicles/{id} - Update vehicle"""
    log("\n🔍 TEST 4: Update Vehicle", Colors.CYAN)
    
    if not vehicle_id:
        log("❌ Skipping update test - no vehicle ID", Colors.RED)
        return False
    
    update_data = {
        "status": "sold",
        "stock_number": "STK-9999",
        "price": 95000,
        "mileage": 12500,
        "notes": "Test update"
    }
    
    try:
        response = requests.patch(
            f"{BACKEND_URL}/api/vehicles/{vehicle_id}",
            json=update_data,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                log(f"✅ Vehicle updated successfully", Colors.GREEN)
                log(f"   Updated fields: {list(update_data.keys())}")
                log(f"   Response: {data}")
                return True
            else:
                log(f"❌ Vehicle update failed - response: {data}", Colors.RED)
                return False
        else:
            log(f"❌ Vehicle update failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return False
            
    except Exception as e:
        log(f"❌ Vehicle update error: {str(e)}", Colors.RED)
        return False

def test_get_inventory_after_update(vehicle_id):
    """Test 5: GET /api/vehicles/inventory - Verify update persisted"""
    log("\n🔍 TEST 5: Verify Update Persisted", Colors.CYAN)
    
    if not vehicle_id:
        log("❌ Skipping persistence verification - no vehicle ID", Colors.RED)
        return False
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/vehicles/inventory", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            vehicles = data.get("vehicles", [])
            
            # Find our updated vehicle
            updated_vehicle = None
            for vehicle in vehicles:
                if vehicle.get("id") == vehicle_id:
                    updated_vehicle = vehicle
                    break
            
            if updated_vehicle:
                log(f"✅ Updated vehicle found", Colors.GREEN)
                log(f"   Status: {updated_vehicle.get('status')}")
                log(f"   Stock Number: {updated_vehicle.get('stock_number')}")
                log(f"   Price: {updated_vehicle.get('price')}")
                log(f"   Mileage: {updated_vehicle.get('mileage')}")
                log(f"   Notes: {updated_vehicle.get('notes')}")
                
                # Verify specific updates
                checks_passed = 0
                total_checks = 5
                
                if updated_vehicle.get('status') == 'sold':
                    checks_passed += 1
                    log(f"   ✓ Status updated to 'sold'")
                else:
                    log(f"   ✗ Status not updated (got: {updated_vehicle.get('status')})", Colors.YELLOW)
                
                if updated_vehicle.get('stock_number') == 'STK-9999':
                    checks_passed += 1
                    log(f"   ✓ Stock number updated")
                else:
                    log(f"   ✗ Stock number not updated (got: {updated_vehicle.get('stock_number')})", Colors.YELLOW)
                
                if updated_vehicle.get('price') == 95000:
                    checks_passed += 1
                    log(f"   ✓ Price updated")
                else:
                    log(f"   ✗ Price not updated (got: {updated_vehicle.get('price')})", Colors.YELLOW)
                    
                if updated_vehicle.get('mileage') == 12500:
                    checks_passed += 1
                    log(f"   ✓ Mileage updated")
                else:
                    log(f"   ✗ Mileage not updated (got: {updated_vehicle.get('mileage')})", Colors.YELLOW)
                    
                if updated_vehicle.get('notes') == 'Test update':
                    checks_passed += 1
                    log(f"   ✓ Notes updated")
                else:
                    log(f"   ✗ Notes not updated (got: {updated_vehicle.get('notes')})", Colors.YELLOW)
                
                success_rate = checks_passed / total_checks
                if success_rate >= 0.8:
                    log(f"   ✅ Update verification passed ({checks_passed}/{total_checks} fields correct)", Colors.GREEN)
                    return True
                else:
                    log(f"   ❌ Update verification failed ({checks_passed}/{total_checks} fields correct)", Colors.RED)
                    return False
                
            else:
                log(f"❌ Vehicle not found after update (ID: {vehicle_id})", Colors.RED)
                return False
        else:
            log(f"❌ Inventory request failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return False
            
    except Exception as e:
        log(f"❌ Update verification error: {str(e)}", Colors.RED)
        return False

def test_delete_vehicle(vehicle_id):
    """Test 6: DELETE /api/vehicles/{id} - Delete test vehicle"""
    log("\n🔍 TEST 6: Delete Vehicle", Colors.CYAN)
    
    if not vehicle_id:
        log("❌ Skipping delete test - no vehicle ID", Colors.RED)
        return False
    
    try:
        response = requests.delete(f"{BACKEND_URL}/api/vehicles/{vehicle_id}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                log(f"✅ Vehicle deleted successfully", Colors.GREEN)
                log(f"   Response: {data}")
                return True
            else:
                log(f"❌ Vehicle deletion failed - response: {data}", Colors.RED)
                return False
        else:
            log(f"❌ Vehicle deletion failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return False
            
    except Exception as e:
        log(f"❌ Vehicle deletion error: {str(e)}", Colors.RED)
        return False

def test_get_inventory_after_delete(vehicle_id):
    """Test 7: GET /api/vehicles/inventory - Verify vehicle is gone"""
    log("\n🔍 TEST 7: Verify Vehicle Deleted", Colors.CYAN)
    
    if not vehicle_id:
        log("❌ Skipping deletion verification - no vehicle ID", Colors.RED)
        return False
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/vehicles/inventory", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            vehicles = data.get("vehicles", [])
            
            # Verify our vehicle is NOT in the list
            deleted_vehicle = None
            for vehicle in vehicles:
                if vehicle.get("id") == vehicle_id:
                    deleted_vehicle = vehicle
                    break
            
            if deleted_vehicle:
                log(f"❌ Vehicle still found in inventory after deletion", Colors.RED)
                log(f"   Vehicle: {deleted_vehicle}")
                return False
            else:
                log(f"✅ Vehicle successfully removed from inventory", Colors.GREEN)
                log(f"   Total vehicles in inventory: {len(vehicles)}")
                return True
        else:
            log(f"❌ Inventory request failed - HTTP {response.status_code}: {response.text}", Colors.RED)
            return False
            
    except Exception as e:
        log(f"❌ Deletion verification error: {str(e)}", Colors.RED)
        return False

def run_vehicle_inventory_tests():
    """Run the complete vehicle inventory API test suite"""
    log("=" * 80, Colors.BOLD)
    log("🚀 VEHICLE INVENTORY BACKEND API TEST SUITE", Colors.BOLD)
    log("=" * 80, Colors.BOLD)
    log("This is critical: IntakeScreen reads inventory from this API via InventoryContext.", Colors.YELLOW)
    log("Any failure here means the Intake tab shows no vehicles.", Colors.YELLOW)
    
    results = {}
    vehicle_id = None
    
    # Test 1: Initial inventory check
    initial_inventory = test_get_inventory_initial()
    results["initial_inventory"] = initial_inventory is not None
    
    # Test 2: Save vehicle to inventory
    vehicle_id = test_save_to_inventory()
    results["save_vehicle"] = vehicle_id is not None
    
    # Test 3: Verify vehicle appears in inventory
    found_vehicle = test_get_inventory_after_save(vehicle_id)
    results["verify_after_save"] = found_vehicle is not None
    
    # Test 4: Update vehicle
    update_success = test_update_vehicle(vehicle_id)
    results["update_vehicle"] = update_success
    
    # Test 5: Verify update persisted
    update_verified = test_get_inventory_after_update(vehicle_id)
    results["verify_after_update"] = update_verified
    
    # Test 6: Delete vehicle
    delete_success = test_delete_vehicle(vehicle_id)
    results["delete_vehicle"] = delete_success
    
    # Test 7: Verify vehicle deleted
    deletion_verified = test_get_inventory_after_delete(vehicle_id)
    results["verify_after_delete"] = deletion_verified
    
    # Summary
    log("\n" + "=" * 80, Colors.BOLD)
    log("📊 VEHICLE INVENTORY TEST RESULTS SUMMARY", Colors.BOLD)
    log("=" * 80, Colors.BOLD)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    test_descriptions = {
        "initial_inventory": "Initial Inventory Check",
        "save_vehicle": "Save Vehicle to Inventory",
        "verify_after_save": "Verify Vehicle in Inventory",
        "update_vehicle": "Update Vehicle",
        "verify_after_update": "Verify Update Persisted", 
        "delete_vehicle": "Delete Vehicle",
        "verify_after_delete": "Verify Deletion"
    }
    
    for test_name, passed in results.items():
        description = test_descriptions.get(test_name, test_name.replace("_", " ").title())
        status = "✅ PASS" if passed else "❌ FAIL"
        color = Colors.GREEN if passed else Colors.RED
        log(f"   {description}: {status}", color)
    
    success_rate = (passed_tests / total_tests) * 100
    log(f"\n🎯 SUCCESS RATE: {passed_tests}/{total_tests} ({success_rate:.1f}%)", 
        Colors.GREEN if success_rate >= 90 else Colors.YELLOW if success_rate >= 70 else Colors.RED)
    
    if success_rate == 100:
        log("🎉 ALL TESTS PASSED! Vehicle inventory API is working perfectly.", Colors.GREEN)
        log("✅ IntakeScreen will be able to read inventory via InventoryContext.", Colors.GREEN)
    elif success_rate >= 90:
        log("✅ Vehicle inventory API is mostly functional with minor issues.", Colors.YELLOW)
        log("⚠️ IntakeScreen should work but may have some issues.", Colors.YELLOW)
    else:
        log("❌ Vehicle inventory API has critical issues that need attention.", Colors.RED)
        log("🚨 IntakeScreen will likely show no vehicles or fail to load inventory.", Colors.RED)
    
    return results

if __name__ == "__main__":
    run_vehicle_inventory_tests()