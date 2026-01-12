"""
CLOSR Field Transforms & OpenAPI Parser Tests
Tests for the new field transformation capabilities:
- GET /api/integrations/transforms - Lists all 31 transform types across 9 categories
- POST /api/integrations/transforms/preview - Preview single transform
- POST /api/integrations/transforms/test - Full mapping config with transforms
- POST /api/integrations/transforms/suggest - Suggest transforms for field
- POST /api/integrations/parse-openapi - Parse OpenAPI spec

Features tested:
1. Composite fields (combine first+last→name)
2. Data transforms (phone formatting, price cleaning, date normalization)
3. Conditional mapping (map based on other field values)
4. Default values (fallback when source empty)
5. OpenAPI spec import for auto-generating configs
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestListTransforms:
    """Tests for GET /api/integrations/transforms - List all available transforms"""
    
    def test_list_all_transforms(self):
        """Test GET /api/integrations/transforms - Returns all 31 transform types across 9 categories"""
        response = requests.get(f"{BASE_URL}/api/integrations/transforms")
        assert response.status_code == 200
        data = response.json()
        
        assert "transforms" in data
        assert "conditions" in data
        
        transforms = data["transforms"]
        conditions = data["conditions"]
        
        # Check all 9 categories exist
        expected_categories = ["string", "phone", "name", "price", "date", "address", "vehicle", "status", "generic"]
        for category in expected_categories:
            assert category in transforms, f"Missing category: {category}"
        
        # Count total transforms
        total_transforms = sum(len(transforms[cat]) for cat in transforms)
        assert total_transforms >= 31, f"Expected at least 31 transforms, got {total_transforms}"
        
        # Check conditions list
        assert len(conditions) >= 13, f"Expected at least 13 condition operators, got {len(conditions)}"
        
        # Verify specific transforms exist
        phone_transforms = [t["type"] for t in transforms["phone"]]
        assert "phone_normalize" in phone_transforms
        assert "phone_format_us" in phone_transforms
        assert "phone_digits_only" in phone_transforms
        
        price_transforms = [t["type"] for t in transforms["price"]]
        assert "price_normalize" in price_transforms
        assert "number_extract" in price_transforms
        
        print(f"✓ Found {total_transforms} transforms across {len(transforms)} categories")
        print(f"✓ Found {len(conditions)} condition operators")


class TestTransformPreview:
    """Tests for POST /api/integrations/transforms/preview - Preview single transform"""
    
    def test_phone_normalize_transform(self):
        """Test phone_normalize: '(555) 123-4567' → '+15551234567'"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/preview",
            json={
                "value": "(555) 123-4567",
                "transform_type": "phone_normalize",
                "params": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["input"] == "(555) 123-4567"
        assert data["output"] == "+15551234567"
        assert data["transform"] == "phone_normalize"
        
        print(f"✓ phone_normalize: '{data['input']}' → '{data['output']}'")
    
    def test_price_normalize_transform(self):
        """Test price_normalize: '$25,999' → 25999.0"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/preview",
            json={
                "value": "$25,999",
                "transform_type": "price_normalize",
                "params": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["input"] == "$25,999"
        assert data["output"] == 25999.0
        
        print(f"✓ price_normalize: '{data['input']}' → {data['output']}")
    
    def test_year_extract_transform(self):
        """Test year_extract: '2024 Toyota Camry' → 2024"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/preview",
            json={
                "value": "2024 Toyota Camry",
                "transform_type": "year_extract",
                "params": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["input"] == "2024 Toyota Camry"
        assert data["output"] == 2024
        
        print(f"✓ year_extract: '{data['input']}' → {data['output']}")
    
    def test_state_abbreviate_transform(self):
        """Test state_abbreviate: 'California' → 'CA'"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/preview",
            json={
                "value": "California",
                "transform_type": "state_abbreviate",
                "params": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["input"] == "California"
        assert data["output"] == "CA"
        
        print(f"✓ state_abbreviate: '{data['input']}' → '{data['output']}'")
    
    def test_status_normalize_transform(self):
        """Test status_normalize: 'Active' → 'hot'"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/preview",
            json={
                "value": "Active",
                "transform_type": "status_normalize",
                "params": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["input"] == "Active"
        assert data["output"] == "hot"
        
        print(f"✓ status_normalize: '{data['input']}' → '{data['output']}'")
    
    def test_zip_normalize_transform(self):
        """Test zip_normalize: '9021' → '09021'"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/preview",
            json={
                "value": "9021",
                "transform_type": "zip_normalize",
                "params": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["input"] == "9021"
        assert data["output"] == "09021"
        
        print(f"✓ zip_normalize: '{data['input']}' → '{data['output']}'")
    
    def test_mileage_normalize_transform(self):
        """Test mileage_normalize: '45,000 miles' → 45000"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/preview",
            json={
                "value": "45,000 miles",
                "transform_type": "mileage_normalize",
                "params": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["input"] == "45,000 miles"
        assert data["output"] == 45000
        
        print(f"✓ mileage_normalize: '{data['input']}' → {data['output']}")
    
    def test_titlecase_transform(self):
        """Test titlecase: 'john smith' → 'John Smith'"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/preview",
            json={
                "value": "john smith",
                "transform_type": "titlecase",
                "params": {}
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["output"] == "John Smith"
        
        print(f"✓ titlecase: '{data['input']}' → '{data['output']}'")
    
    def test_invalid_transform_type(self):
        """Test invalid transform type returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/preview",
            json={
                "value": "test",
                "transform_type": "invalid_transform",
                "params": {}
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "Unknown transform type" in data.get("detail", "")
        
        print("✓ Correctly returns 400 for invalid transform type")


class TestMappingConfigTest:
    """Tests for POST /api/integrations/transforms/test - Full mapping config"""
    
    def test_composite_name_field(self):
        """Test composite field: combine first_name + last_name → name with titlecase"""
        mapping_config = {
            "customer_mappings": [
                {
                    "target_field": "name",
                    "source_fields": ["first_name", "last_name"],
                    "composite_template": "{first_name} {last_name}",
                    "transforms": [
                        {"type": "trim", "params": {}},
                        {"type": "titlecase", "params": {}}
                    ]
                }
            ],
            "vehicle_mappings": [],
            "global_transforms": [],
            "global_defaults": {}
        }
        
        sample_record = {
            "first_name": "john",
            "last_name": "SMITH"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "customers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["name"] == "John Smith"
        
        print(f"✓ Composite name: first_name='john', last_name='SMITH' → name='{data['output']['name']}'")
    
    def test_conditional_mapping_with_fallback(self):
        """Test conditional mapping with fallback_source"""
        mapping_config = {
            "customer_mappings": [
                {
                    "target_field": "phone",
                    "source_field": "mobile_phone",
                    "conditions": [
                        {"field": "mobile_phone", "operator": "is_not_empty", "value": None}
                    ],
                    "fallback_source": "home_phone",
                    "transforms": [
                        {"type": "phone_normalize", "params": {}}
                    ]
                }
            ],
            "vehicle_mappings": [],
            "global_transforms": [],
            "global_defaults": {}
        }
        
        # Test with mobile_phone empty - should use fallback
        sample_record = {
            "mobile_phone": "",
            "home_phone": "(555) 987-6543"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "customers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["phone"] == "+15559876543"
        
        print(f"✓ Conditional mapping with fallback: mobile_phone='' → uses home_phone → '{data['output']['phone']}'")
    
    def test_default_values_when_source_empty(self):
        """Test default values applied when source is empty"""
        mapping_config = {
            "customer_mappings": [
                {
                    "target_field": "status",
                    "source_field": "lead_status",
                    "transforms": [
                        {"type": "lowercase", "params": {}},
                        {"type": "status_normalize", "params": {}}
                    ],
                    "default_value": "new"
                },
                {
                    "target_field": "name",
                    "source_field": "customer_name",
                    "default_value": "Unknown Customer"
                }
            ],
            "vehicle_mappings": [],
            "global_transforms": [],
            "global_defaults": {}
        }
        
        # Test with empty source fields
        sample_record = {
            "lead_status": "",
            "customer_name": ""
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "customers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["status"] == "new"
        assert data["output"]["name"] == "Unknown Customer"
        
        print(f"✓ Default values: empty status → '{data['output']['status']}', empty name → '{data['output']['name']}'")
    
    def test_multiple_data_transforms(self):
        """Test multiple data transforms: state_abbreviate, status_normalize, zip_normalize"""
        mapping_config = {
            "customer_mappings": [
                {
                    "target_field": "state",
                    "source_field": "customer_state",
                    "transforms": [
                        {"type": "state_abbreviate", "params": {}}
                    ]
                },
                {
                    "target_field": "status",
                    "source_field": "lead_status",
                    "transforms": [
                        {"type": "lowercase", "params": {}},
                        {"type": "status_normalize", "params": {}}
                    ]
                },
                {
                    "target_field": "zip",
                    "source_field": "postal_code",
                    "transforms": [
                        {"type": "zip_normalize", "params": {}}
                    ]
                }
            ],
            "vehicle_mappings": [],
            "global_transforms": [],
            "global_defaults": {}
        }
        
        sample_record = {
            "customer_state": "California",
            "lead_status": "Interested",
            "postal_code": "9021"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "customers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["state"] == "CA"
        assert data["output"]["status"] == "warm"  # "interested" maps to "warm"
        assert data["output"]["zip"] == "09021"
        
        print(f"✓ Multiple transforms: state='{data['output']['state']}', status='{data['output']['status']}', zip='{data['output']['zip']}'")
    
    def test_vehicle_transforms(self):
        """Test vehicle-specific transforms: year_extract, mileage_normalize, price_normalize"""
        mapping_config = {
            "customer_mappings": [],
            "vehicle_mappings": [
                {
                    "target_field": "year",
                    "source_field": "vehicle_description",
                    "transforms": [
                        {"type": "year_extract", "params": {}}
                    ]
                },
                {
                    "target_field": "mileage",
                    "source_field": "odometer",
                    "transforms": [
                        {"type": "mileage_normalize", "params": {}}
                    ]
                },
                {
                    "target_field": "price",
                    "source_field": "asking_price",
                    "transforms": [
                        {"type": "price_normalize", "params": {}}
                    ]
                }
            ],
            "global_transforms": [],
            "global_defaults": {}
        }
        
        sample_record = {
            "vehicle_description": "2024 Toyota Camry XLE",
            "odometer": "15,500 miles",
            "asking_price": "$32,999.00"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "vehicles"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["year"] == 2024
        assert data["output"]["mileage"] == 15500
        assert data["output"]["price"] == 32999.0
        
        print(f"✓ Vehicle transforms: year={data['output']['year']}, mileage={data['output']['mileage']}, price={data['output']['price']}")
    
    def test_global_transforms(self):
        """Test global transforms applied to all fields"""
        mapping_config = {
            "customer_mappings": [
                {
                    "target_field": "name",
                    "source_field": "customer_name"
                },
                {
                    "target_field": "email",
                    "source_field": "email_address"
                }
            ],
            "vehicle_mappings": [],
            "global_transforms": [
                {"type": "trim", "params": {}}
            ],
            "global_defaults": {}
        }
        
        sample_record = {
            "customer_name": "  John Doe  ",
            "email_address": "  john@example.com  "
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "customers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["name"] == "John Doe"
        assert data["output"]["email"] == "john@example.com"
        
        print(f"✓ Global trim transform applied to all fields")


class TestTransformSuggest:
    """Tests for POST /api/integrations/transforms/suggest - Suggest transforms for field"""
    
    def test_suggest_transforms_for_phone(self):
        """Test suggest transforms for phone field"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/suggest",
            params={
                "source_field": "contact_phone",
                "sample_value": "(555) 123-4567",
                "target_field": "phone",
                "data_type": "customers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["source_field"] == "contact_phone"
        assert data["target_field"] == "phone"
        assert "suggestions" in data
        assert len(data["suggestions"]) >= 2
        
        # Check phone_normalize suggestion exists
        transform_types = [s["transforms"][0]["type"] for s in data["suggestions"]]
        assert "phone_normalize" in transform_types
        assert "phone_format_us" in transform_types
        
        # Check preview is included
        for suggestion in data["suggestions"]:
            if suggestion["transforms"][0]["type"] == "phone_normalize":
                assert suggestion["preview"] == "+15551234567"
        
        print(f"✓ Suggested {len(data['suggestions'])} transforms for phone field")
    
    def test_suggest_transforms_for_price(self):
        """Test suggest transforms for price field"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/suggest",
            params={
                "source_field": "asking_price",
                "sample_value": "$25,999.00",
                "target_field": "price",
                "data_type": "vehicles"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["target_field"] == "price"
        assert len(data["suggestions"]) >= 1
        
        # Check price_normalize suggestion
        transform_types = [s["transforms"][0]["type"] for s in data["suggestions"]]
        assert "price_normalize" in transform_types
        
        for suggestion in data["suggestions"]:
            if suggestion["transforms"][0]["type"] == "price_normalize":
                assert suggestion["preview"] == 25999.0
        
        print(f"✓ Suggested transforms for price field with preview")
    
    def test_suggest_transforms_for_name(self):
        """Test suggest transforms for name field"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/suggest",
            params={
                "source_field": "customer_name",
                "sample_value": "  john doe  ",
                "target_field": "name",
                "data_type": "customers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["target_field"] == "name"
        assert len(data["suggestions"]) >= 1
        
        # Should suggest titlecase + trim
        found_titlecase = False
        for suggestion in data["suggestions"]:
            transform_types = [t["type"] for t in suggestion["transforms"]]
            if "titlecase" in transform_types:
                found_titlecase = True
        
        assert found_titlecase, "Should suggest titlecase for name field"
        
        print(f"✓ Suggested transforms for name field")
    
    def test_suggest_transforms_for_year(self):
        """Test suggest transforms for year field"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/suggest",
            params={
                "source_field": "vehicle_title",
                "sample_value": "2024 Honda Accord",
                "target_field": "year",
                "data_type": "vehicles"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["target_field"] == "year"
        
        # Should suggest year_extract
        transform_types = [s["transforms"][0]["type"] for s in data["suggestions"]]
        assert "year_extract" in transform_types
        
        for suggestion in data["suggestions"]:
            if suggestion["transforms"][0]["type"] == "year_extract":
                assert suggestion["preview"] == 2024
        
        print(f"✓ Suggested year_extract for year field")


class TestOpenAPIParser:
    """Tests for POST /api/integrations/parse-openapi - Parse OpenAPI spec"""
    
    def test_parse_openapi_3_spec(self):
        """Test parsing OpenAPI 3.0 spec"""
        openapi_spec = {
            "openapi": "3.0.0",
            "info": {
                "title": "Test CRM API",
                "description": "A test CRM API for customers and vehicles",
                "version": "1.0.0"
            },
            "servers": [
                {"url": "https://api.testcrm.com/v1"}
            ],
            "paths": {
                "/customers": {
                    "get": {
                        "operationId": "getCustomers",
                        "summary": "Get all customers",
                        "tags": ["customers"],
                        "responses": {
                            "200": {
                                "description": "List of customers",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "type": "array",
                                            "items": {
                                                "$ref": "#/components/schemas/Customer"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                "/vehicles": {
                    "get": {
                        "operationId": "getVehicles",
                        "summary": "Get all vehicles in inventory",
                        "tags": ["inventory"],
                        "responses": {
                            "200": {
                                "description": "List of vehicles"
                            }
                        }
                    }
                }
            },
            "components": {
                "schemas": {
                    "Customer": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "name": {"type": "string"},
                            "email": {"type": "string"},
                            "phone": {"type": "string"}
                        }
                    }
                },
                "securitySchemes": {
                    "apiKey": {
                        "type": "apiKey",
                        "in": "header",
                        "name": "X-API-Key"
                    }
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/parse-openapi",
            json={"spec_content": json.dumps(openapi_spec)}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["spec_version"] == "openapi_3.0"
        
        # Check API info
        assert data["api_info"]["title"] == "Test CRM API"
        assert data["api_info"]["version"] == "1.0.0"
        
        # Check base URL
        assert data["base_url"] == "https://api.testcrm.com/v1"
        
        # Check auth methods
        assert len(data["auth_methods"]) >= 1
        assert data["auth_methods"][0]["method"] == "api_key"
        assert data["auth_methods"][0]["name"] == "X-API-Key"
        
        # Check endpoints
        assert len(data["endpoints"]) >= 2
        
        # Check suggested config
        assert "suggested_config" in data
        assert data["suggested_config"]["name"] == "Test CRM API"
        
        # Check customers endpoint detection
        assert data["customers_endpoint"]["path"] == "/customers"
        assert data["customers_endpoint"]["confidence"] > 0
        
        # Check vehicles endpoint detection
        assert data["vehicles_endpoint"]["path"] == "/vehicles"
        assert data["vehicles_endpoint"]["confidence"] > 0
        
        print(f"✓ Parsed OpenAPI 3.0 spec: {data['api_info']['title']}")
        print(f"  - Base URL: {data['base_url']}")
        print(f"  - Endpoints: {len(data['endpoints'])}")
        print(f"  - Customers endpoint: {data['customers_endpoint']['path']}")
        print(f"  - Vehicles endpoint: {data['vehicles_endpoint']['path']}")
    
    def test_parse_swagger_2_spec(self):
        """Test parsing Swagger 2.0 spec"""
        swagger_spec = {
            "swagger": "2.0",
            "info": {
                "title": "Legacy CRM API",
                "version": "2.0.0"
            },
            "host": "api.legacycrm.com",
            "basePath": "/api/v2",
            "schemes": ["https"],
            "paths": {
                "/leads": {
                    "get": {
                        "operationId": "getLeads",
                        "summary": "Get all leads/customers",
                        "tags": ["leads"],
                        "responses": {
                            "200": {
                                "description": "List of leads"
                            }
                        }
                    }
                },
                "/inventory": {
                    "get": {
                        "operationId": "getInventory",
                        "summary": "Get vehicle inventory",
                        "tags": ["inventory"],
                        "responses": {
                            "200": {
                                "description": "List of vehicles"
                            }
                        }
                    }
                }
            },
            "securityDefinitions": {
                "basicAuth": {
                    "type": "basic"
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/parse-openapi",
            json={"spec_content": json.dumps(swagger_spec)}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["spec_version"] == "swagger_2.0"
        
        # Check base URL construction
        assert data["base_url"] == "https://api.legacycrm.com/api/v2"
        
        # Check auth method
        assert len(data["auth_methods"]) >= 1
        assert data["auth_methods"][0]["method"] == "basic_auth"
        
        print(f"✓ Parsed Swagger 2.0 spec: {data['api_info']['title']}")
        print(f"  - Base URL: {data['base_url']}")
    
    def test_parse_openapi_invalid_spec(self):
        """Test parsing invalid spec returns error"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/parse-openapi",
            json={"spec_content": "not valid json or yaml {"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == False
        assert len(data["errors"]) > 0
        
        print(f"✓ Correctly handles invalid spec: {data['errors'][0][:50]}...")
    
    def test_parse_openapi_missing_version(self):
        """Test parsing spec without version field"""
        invalid_spec = {
            "info": {
                "title": "No Version API"
            },
            "paths": {}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/parse-openapi",
            json={"spec_content": json.dumps(invalid_spec)}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == False
        assert any("version" in err.lower() or "openapi" in err.lower() or "swagger" in err.lower() 
                   for err in data["errors"])
        
        print("✓ Correctly rejects spec without version field")
    
    def test_parse_openapi_no_input(self):
        """Test parsing with no input returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/parse-openapi",
            json={}
        )
        assert response.status_code == 400
        data = response.json()
        assert "spec_content" in data.get("detail", "").lower() or "spec_url" in data.get("detail", "").lower()
        
        print("✓ Correctly returns 400 when no input provided")
    
    def test_parse_openapi_yaml_format(self):
        """Test parsing YAML format spec"""
        yaml_spec = """
openapi: "3.0.0"
info:
  title: YAML Test API
  version: "1.0.0"
servers:
  - url: https://api.yamltest.com
paths:
  /customers:
    get:
      summary: Get customers
      responses:
        "200":
          description: OK
"""
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/parse-openapi",
            json={"spec_content": yaml_spec}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["api_info"]["title"] == "YAML Test API"
        
        print(f"✓ Parsed YAML format spec: {data['api_info']['title']}")


class TestConditionOperators:
    """Tests for condition operators in conditional mapping"""
    
    def test_equals_condition(self):
        """Test equals condition operator"""
        mapping_config = {
            "customer_mappings": [
                {
                    "target_field": "priority",
                    "source_field": "vip_status",
                    "conditions": [
                        {"field": "customer_type", "operator": "equals", "value": "premium"}
                    ],
                    "fallback_source": "default_priority"
                }
            ],
            "vehicle_mappings": [],
            "global_transforms": [],
            "global_defaults": {}
        }
        
        # Test when condition is met
        sample_record = {
            "customer_type": "premium",
            "vip_status": "high",
            "default_priority": "normal"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "customers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["priority"] == "high"
        
        # Test when condition is NOT met
        sample_record["customer_type"] = "standard"
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "customers"
            }
        )
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["priority"] == "normal"  # Uses fallback
        
        print("✓ equals condition operator works correctly")
    
    def test_greater_than_condition(self):
        """Test greater_than condition operator"""
        mapping_config = {
            "customer_mappings": [
                {
                    "target_field": "tier",
                    "source_field": "premium_tier",
                    "conditions": [
                        {"field": "purchase_count", "operator": "greater_than", "value": "10"}
                    ],
                    "fallback_source": "standard_tier"
                }
            ],
            "vehicle_mappings": [],
            "global_transforms": [],
            "global_defaults": {}
        }
        
        # Test when condition is met (purchase_count > 10)
        sample_record = {
            "purchase_count": 15,
            "premium_tier": "gold",
            "standard_tier": "bronze"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "customers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["tier"] == "gold"
        
        # Test when condition is NOT met
        sample_record["purchase_count"] = 5
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "customers"
            }
        )
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["tier"] == "bronze"  # Uses fallback
        
        print("✓ greater_than condition operator works correctly")
    
    def test_contains_condition(self):
        """Test contains condition operator"""
        mapping_config = {
            "customer_mappings": [
                {
                    "target_field": "source",
                    "source_field": "web_source",
                    "conditions": [
                        {"field": "referral_url", "operator": "contains", "value": "google"}
                    ],
                    "fallback_source": "other_source"
                }
            ],
            "vehicle_mappings": [],
            "global_transforms": [],
            "global_defaults": {}
        }
        
        # Test when condition is met
        sample_record = {
            "referral_url": "https://www.google.com/search?q=cars",
            "web_source": "Google Ads",
            "other_source": "Direct"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/integrations/transforms/test",
            json={
                "sample_record": sample_record,
                "mapping_config": mapping_config,
                "data_type": "customers"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["output"]["source"] == "Google Ads"
        
        print("✓ contains condition operator works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
