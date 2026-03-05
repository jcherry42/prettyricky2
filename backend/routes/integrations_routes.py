"""Integrations Routes: CRM integrations, field discovery, transforms,
profiles, webhooks, event processing.
Extracted from server.py for modularity."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import os
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None
_integration_manager = None
_webhook_receiver = None
_event_processor = None


def init_integrations_routes(db):
    global _db, _integration_manager, _webhook_receiver, _event_processor
    _db = db

    from integrations import IntegrationManager
    from integrations.webhooks import FortifiedWebhookReceiver
    from webhook_processor import WebhookEventProcessor

    _integration_manager = IntegrationManager(db)
    _webhook_receiver = FortifiedWebhookReceiver(db)
    _event_processor = WebhookEventProcessor(db)


# --- Request Models ---

class CreateIntegrationRequest(BaseModel):
    name: str
    adapter_type: str
    base_url: str = ""
    auth_config: Dict[str, Any] = Field(default_factory=dict)
    data_type: str = "customers"
    field_mappings: Optional[Dict[str, str]] = None
    mock_mode: bool = False

class UpdateIntegrationRequest(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    is_active: Optional[bool] = None
    mock_mode: Optional[bool] = None
    auth_config: Optional[Dict[str, Any]] = None
    field_mappings: Optional[Dict[str, str]] = None

class RegisterWebhookRequest(BaseModel):
    integration_id: str
    name: str
    auth_method: str = "hmac_sha256"
    enabled_events: Optional[List[str]] = None

class DiscoverFieldsRequest(BaseModel):
    base_url: str
    endpoint: str
    auth_config: Dict[str, Any] = Field(default_factory=dict)
    data_type: str = "customers"

class DiscoverFromSampleRequest(BaseModel):
    sample_json: str
    data_type: str = "customers"

class SuggestMappingsRequest(BaseModel):
    sample_json: str
    data_type: str = "customers"
    adapter_type: str = "generic_rest"

class TransformPreviewRequest(BaseModel):
    transform_type: str
    value: Any
    params: Dict[str, Any] = Field(default_factory=dict)
    record: Dict[str, Any] = Field(default_factory=dict)

class TransformTestRequest(BaseModel):
    mapping_config: Dict[str, Any]
    sample_record: Dict[str, Any]
    data_type: str = "customers"

class CreateProfileRequest(BaseModel):
    name: str
    description: str = ""
    adapter_type: str = "generic_rest"
    base_url: str = ""
    auth_method: str = "api_key"
    customers_endpoint: str = "/customers"
    vehicles_endpoint: str = "/vehicles"
    customer_mappings: Dict[str, str] = Field(default_factory=dict)
    vehicle_mappings: Dict[str, str] = Field(default_factory=dict)
    pagination_type: str = "offset"
    page_size: int = 100
    records_path: str = "data"
    is_public: bool = False
    tags: List[str] = Field(default_factory=list)

class ImportProfileRequest(BaseModel):
    json_data: str
    override_name: Optional[str] = None


# ============== ADAPTERS ==============

@router.get("/integrations/adapters")
async def list_available_adapters():
    return {"adapters": _integration_manager.list_available_adapters()}

@router.get("/integrations/adapters/{adapter_type}")
async def get_adapter_setup(adapter_type: str):
    instructions = _integration_manager.get_adapter_setup_instructions(adapter_type)
    if not instructions:
        raise HTTPException(status_code=404, detail="Adapter type not found")
    return instructions


# ============== FIELD DISCOVERY ==============

@router.post("/integrations/discover-fields")
async def discover_fields_from_api(request: DiscoverFieldsRequest):
    from integrations.field_discovery import get_discovery_service
    discovery = get_discovery_service()
    result = await discovery.discover_from_api(
        base_url=request.base_url, endpoint=request.endpoint,
        auth_config=request.auth_config, data_type=request.data_type,
    )
    return {
        "success": result.success,
        "data_type": result.data_type,
        "discovered_fields": [
            {
                "source_name": f.source_name, "source_path": f.source_path,
                "sample_value": f.sample_value, "inferred_type": f.inferred_type,
                "suggested_mapping": f.suggested_mapping, "confidence": f.confidence,
                "is_mapped": f.is_mapped,
            }
            for f in result.discovered_fields
        ],
        "sample_record": result.sample_record,
        "unmapped_required": result.unmapped_required,
        "errors": result.errors, "warnings": result.warnings,
    }

@router.post("/integrations/discover-fields/sample")
async def discover_fields_from_sample(request: DiscoverFromSampleRequest):
    from integrations.field_discovery import get_discovery_service
    discovery = get_discovery_service()
    result = discovery.discover_from_sample(
        sample_json=request.sample_json, data_type=request.data_type,
    )
    return {
        "success": result.success,
        "data_type": result.data_type,
        "discovered_fields": [
            {
                "source_name": f.source_name, "source_path": f.source_path,
                "sample_value": f.sample_value, "inferred_type": f.inferred_type,
                "suggested_mapping": f.suggested_mapping, "confidence": f.confidence,
                "is_mapped": f.is_mapped,
            }
            for f in result.discovered_fields
        ],
        "sample_record": result.sample_record,
        "unmapped_required": result.unmapped_required,
        "errors": result.errors, "warnings": result.warnings,
    }


# ============== OPENAPI SPEC IMPORT ==============

@router.post("/integrations/discover-fields/openapi")
async def discover_fields_from_openapi(request: Dict[str, Any]):
    from integrations.field_discovery import get_discovery_service
    discovery = get_discovery_service()
    spec_url = request.get("spec_url")
    spec_json = request.get("spec_json")
    data_type = request.get("data_type", "customers")
    if not spec_url and not spec_json:
        raise HTTPException(status_code=400, detail="Provide spec_url or spec_json")
    result = await discovery.discover_from_openapi(
        spec_url=spec_url, spec_json=spec_json, data_type=data_type,
    )
    return {
        "success": result.success,
        "data_type": result.data_type,
        "discovered_fields": [
            {
                "source_name": f.source_name, "source_path": f.source_path,
                "sample_value": f.sample_value, "inferred_type": f.inferred_type,
                "suggested_mapping": f.suggested_mapping, "confidence": f.confidence,
                "is_mapped": f.is_mapped,
            }
            for f in result.discovered_fields
        ],
        "sample_record": result.sample_record,
        "unmapped_required": result.unmapped_required,
        "errors": result.errors, "warnings": result.warnings,
    }


# ============== SMART SUGGEST ==============

@router.post("/integrations/suggest-mappings")
async def suggest_mappings(request: SuggestMappingsRequest):
    from integrations.smart_suggest import SmartSuggestService
    suggest_service = SmartSuggestService()
    result = await suggest_service.suggest_mappings(
        sample_json=request.sample_json,
        data_type=request.data_type,
        adapter_type=request.adapter_type,
    )
    return {
        "success": result.get("success", True),
        "suggestions": result.get("suggestions", []),
        "data_type": request.data_type,
    }

@router.get("/integrations/schemas/{data_type}")
async def get_target_schema(data_type: str):
    from integrations.field_discovery import CUSTOMER_SCHEMA, VEHICLE_SCHEMA
    if data_type == "customers":
        return {"schema": CUSTOMER_SCHEMA, "data_type": "customers"}
    elif data_type == "vehicles":
        return {"schema": VEHICLE_SCHEMA, "data_type": "vehicles"}
    raise HTTPException(status_code=400, detail=f"Unknown data type: {data_type}")


# ============== FIELD TRANSFORMS ==============

@router.get("/integrations/transforms")
async def list_available_transforms():
    from integrations.field_transforms import TransformType, Transform, FieldTransformEngine, MappingConfig
    transforms = {
        "text": [
            {"type": "uppercase", "description": "Convert to UPPERCASE"},
            {"type": "lowercase", "description": "Convert to lowercase"},
            {"type": "titlecase", "description": "Convert to Title Case"},
            {"type": "trim", "description": "Remove leading/trailing whitespace"},
        ],
        "phone": [
            {"type": "phone_normalize", "description": "Normalize to +1XXXXXXXXXX"},
            {"type": "phone_format_us", "description": "Format as (XXX) XXX-XXXX"},
        ],
        "name": [
            {"type": "name_combine", "description": "Combine first + last name", "params": ["fields"]},
            {"type": "name_split_first", "description": "Extract first name"},
            {"type": "name_split_last", "description": "Extract last name"},
        ],
        "price": [
            {"type": "price_normalize", "description": "Remove $ and commas"},
            {"type": "price_format", "description": "Format as $XX,XXX.XX"},
        ],
        "date": [
            {"type": "date_normalize", "description": "Normalize to ISO 8601"},
            {"type": "date_format", "description": "Custom date format", "params": ["format"]},
        ],
        "address": [
            {"type": "address_combine", "description": "Combine address parts", "params": ["fields", "separator"]},
            {"type": "state_abbreviate", "description": "Abbreviate state name"},
            {"type": "state_expand", "description": "Expand state abbreviation"},
            {"type": "zip_normalize", "description": "Normalize ZIP code"},
        ],
        "vehicle": [
            {"type": "vin_validate", "description": "Validate and uppercase VIN"},
            {"type": "year_extract", "description": "Extract year from string"},
            {"type": "mileage_normalize", "description": "Extract mileage number"},
        ],
        "status": [
            {"type": "status_normalize", "description": "Normalize to standard values"},
        ],
        "generic": [
            {"type": "regex_extract", "description": "Extract via regex", "params": ["pattern", "group"]},
            {"type": "regex_replace", "description": "Replace via regex", "params": ["pattern", "replacement"]},
            {"type": "template", "description": "String template", "params": ["template"]},
            {"type": "lookup", "description": "Map via lookup table", "params": ["table", "default"]},
            {"type": "coalesce", "description": "First non-empty value", "params": ["fields"]},
            {"type": "split", "description": "Split and take part", "params": ["delimiter", "index"]},
            {"type": "join", "description": "Join multiple fields", "params": ["fields", "delimiter"]},
        ],
    }
    conditions = [
        {"operator": "equals", "description": "Field equals value"},
        {"operator": "not_equals", "description": "Field does not equal value"},
        {"operator": "contains", "description": "Field contains value"},
        {"operator": "not_contains", "description": "Field does not contain value"},
        {"operator": "starts_with", "description": "Field starts with value"},
        {"operator": "ends_with", "description": "Field ends with value"},
        {"operator": "matches_regex", "description": "Field matches regex pattern"},
        {"operator": "is_empty", "description": "Field is empty or null"},
        {"operator": "is_not_empty", "description": "Field has a value"},
        {"operator": "greater_than", "description": "Field > value (numeric)"},
        {"operator": "less_than", "description": "Field < value (numeric)"},
        {"operator": "in_list", "description": "Field is in list of values"},
        {"operator": "not_in_list", "description": "Field is not in list of values"},
    ]
    return {"transforms": transforms, "conditions": conditions}

@router.post("/integrations/transforms/preview")
async def preview_transform(request: TransformPreviewRequest):
    from integrations.field_transforms import TransformType, Transform
    try:
        transform_type = TransformType(request.transform_type)
        transform = Transform(type=transform_type, params=request.params)
        result = transform.apply(request.value, request.record)
        return {"success": True, "input": request.value, "output": result, "transform": request.transform_type}
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown transform type: {request.transform_type}")
    except Exception as e:
        return {"success": False, "input": request.value, "output": None, "error": str(e)}

@router.post("/integrations/transforms/test")
async def test_mapping_config(request: TransformTestRequest):
    from integrations.field_transforms import MappingConfig, FieldTransformEngine
    try:
        config = MappingConfig.from_dict(request.mapping_config)
        engine = FieldTransformEngine(config)
        if request.data_type == "customers":
            result = engine.transform_customer(request.sample_record)
        else:
            result = engine.transform_vehicle(request.sample_record)
        return {"success": True, "input": request.sample_record, "output": result, "data_type": request.data_type}
    except Exception as e:
        logger.error(f"Transform test error: {e}")
        return {"success": False, "error": str(e)}

@router.post("/integrations/transforms/suggest")
async def suggest_transforms_for_field(
    source_field: str, sample_value: Any, target_field: str, data_type: str = "customers"
):
    from integrations.field_transforms import TransformType, Transform
    suggestions = []
    if target_field == "phone":
        suggestions.append({
            "transforms": [{"type": "phone_normalize", "params": {}}],
            "description": "Normalize phone to +1XXXXXXXXXX format",
            "preview": Transform(type=TransformType.PHONE_NORMALIZE).apply(sample_value, {}),
        })
    elif target_field == "name":
        suggestions.append({
            "transforms": [{"type": "titlecase", "params": {}}, {"type": "trim", "params": {}}],
            "description": "Title case and trim whitespace",
        })
    elif target_field == "price":
        suggestions.append({
            "transforms": [{"type": "price_normalize", "params": {}}],
            "description": "Remove $ and commas, convert to number",
            "preview": Transform(type=TransformType.PRICE_NORMALIZE).apply(sample_value, {}),
        })
    elif target_field == "vin":
        suggestions.append({
            "transforms": [{"type": "vin_validate", "params": {}}],
            "description": "Validate and uppercase VIN",
        })
    else:
        suggestions.append({
            "transforms": [{"type": "trim", "params": {}}],
            "description": "Trim whitespace",
            "preview": Transform(type=TransformType.TRIM).apply(sample_value, {}),
        })
    return {"source_field": source_field, "target_field": target_field, "sample_value": sample_value, "suggestions": suggestions}


# ============== INTEGRATION PROFILES ==============

@router.get("/integration-profiles")
async def list_profiles(adapter_type: Optional[str] = None, public_only: bool = False, tags: Optional[str] = None, limit: int = 50):
    from integrations.profiles import ProfileManager
    pm = ProfileManager(_db)
    tag_list = tags.split(",") if tags else None
    profiles = await pm.list_profiles(adapter_type=adapter_type, public_only=public_only, tags=tag_list, limit=limit)
    return {"profiles": profiles}

@router.post("/integration-profiles")
async def create_profile(request: CreateProfileRequest):
    from integrations.profiles import ProfileManager, IntegrationProfile
    import uuid
    pm = ProfileManager(_db)
    profile = IntegrationProfile(
        id=str(uuid.uuid4()), name=request.name, description=request.description,
        adapter_type=request.adapter_type, base_url=request.base_url,
        auth_method=request.auth_method,
        customers_endpoint=request.customers_endpoint, vehicles_endpoint=request.vehicles_endpoint,
        customer_mappings=request.customer_mappings, vehicle_mappings=request.vehicle_mappings,
        pagination_type=request.pagination_type, page_size=request.page_size,
        records_path=request.records_path, is_public=request.is_public, tags=request.tags,
    )
    profile_id = await pm.create_profile(profile)
    return {"success": True, "profile_id": profile_id}

@router.get("/integration-profiles/{profile_id}")
async def get_profile(profile_id: str):
    from integrations.profiles import ProfileManager
    pm = ProfileManager(_db)
    profile = await pm.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile.to_dict()

@router.get("/integration-profiles/{profile_id}/export")
async def export_profile(profile_id: str):
    from integrations.profiles import ProfileManager
    pm = ProfileManager(_db)
    json_data = await pm.export_profile(profile_id)
    if not json_data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"json": json_data}

@router.post("/integration-profiles/import")
async def import_profile(request: ImportProfileRequest):
    from integrations.profiles import ProfileManager
    pm = ProfileManager(_db)
    success, message, profile_id = await pm.import_profile(json_data=request.json_data, override_name=request.override_name)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "profile_id": profile_id}

@router.delete("/integration-profiles/{profile_id}")
async def delete_profile(profile_id: str):
    from integrations.profiles import ProfileManager
    if profile_id.startswith("builtin_"):
        raise HTTPException(status_code=400, detail="Cannot delete built-in profiles")
    pm = ProfileManager(_db)
    success = await pm.delete_profile(profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"success": True}

@router.patch("/integration-profiles/{profile_id}")
async def update_profile(profile_id: str, updates: Dict[str, Any]):
    from integrations.profiles import ProfileManager
    if profile_id.startswith("builtin_"):
        raise HTTPException(status_code=400, detail="Cannot modify built-in profiles")
    pm = ProfileManager(_db)
    success = await pm.update_profile(profile_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"success": True}


# ============== INTEGRATIONS CRUD ==============

@router.get("/integrations")
async def list_integrations(active_only: bool = False, adapter_type: Optional[str] = None):
    integrations = await _integration_manager.list_integrations(active_only=active_only, adapter_type=adapter_type)
    return {"integrations": integrations}

@router.post("/integrations")
async def create_integration(request: CreateIntegrationRequest):
    try:
        integration_id = await _integration_manager.create_integration(
            name=request.name, adapter_type=request.adapter_type,
            base_url=request.base_url, auth_config=request.auth_config,
            data_type=request.data_type, field_mappings=request.field_mappings,
            mock_mode=request.mock_mode,
        )
        return {"success": True, "integration_id": integration_id, "message": f"Integration '{request.name}' created"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create integration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/integrations/health")
async def get_integrations_health():
    return await _integration_manager.get_health_summary()

@router.get("/integrations/{integration_id}")
async def get_integration(integration_id: str):
    integration = await _integration_manager.get_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration

@router.get("/integrations/{integration_id}/health")
async def get_integration_health(integration_id: str):
    health = await _integration_manager.get_integration_health(integration_id)
    if "error" in health:
        raise HTTPException(status_code=404, detail=health["error"])
    return health

@router.patch("/integrations/{integration_id}")
async def update_integration(integration_id: str, request: UpdateIntegrationRequest):
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    success = await _integration_manager.update_integration(integration_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"success": True}

@router.delete("/integrations/{integration_id}")
async def delete_integration(integration_id: str):
    success = await _integration_manager.delete_integration(integration_id)
    if not success:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"success": True}

@router.post("/integrations/{integration_id}/test")
async def test_integration_connection(integration_id: str):
    return await _integration_manager.test_connection(integration_id)

@router.post("/integrations/{integration_id}/sync")
async def sync_integration(integration_id: str, full_sync: bool = False):
    result = await _integration_manager.sync_integration(integration_id, full_sync=full_sync)
    return {
        "success": result.success, "records_fetched": result.total_records,
        "pages_fetched": result.pages_fetched, "duration_ms": result.fetch_duration_ms,
        "errors": result.errors[:10] if result.errors else [],
        "warnings": result.warnings[:10] if result.warnings else [],
    }

@router.post("/integrations/{integration_id}/toggle-mock")
async def toggle_integration_mock_mode(integration_id: str, enabled: bool):
    success = await _integration_manager.toggle_mock_mode(integration_id, enabled)
    if not success:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"success": True, "mock_mode": enabled}


# ============== WEBHOOKS ==============

@router.get("/webhooks")
async def list_webhooks(integration_id: Optional[str] = None, active_only: bool = False):
    webhooks = await _webhook_receiver.list_webhooks(integration_id=integration_id, active_only=active_only)
    return {"webhooks": webhooks}

@router.post("/webhooks")
async def register_webhook(request: RegisterWebhookRequest):
    from integrations.webhooks import WebhookAuthMethod
    try:
        auth_method = WebhookAuthMethod(request.auth_method)
    except ValueError:
        auth_method = WebhookAuthMethod.HMAC_SHA256
    config = await _webhook_receiver.register_webhook(
        integration_id=request.integration_id, name=request.name,
        auth_method=auth_method, enabled_events=request.enabled_events,
    )
    return {
        "success": True, "webhook_id": config.id,
        "endpoint_url": f"/api/webhooks/{config.id}/receive",
        "credentials": {
            "hmac_secret": config.auth.hmac_secret,
            "api_key": config.auth.api_key,
            "signature_header": config.auth.signature_header,
        }
    }

@router.get("/webhooks/{webhook_id}")
async def get_webhook(webhook_id: str):
    config = await _webhook_receiver.get_webhook(webhook_id)
    if not config:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {
        "id": config.id, "name": config.name, "integration_id": config.integration_id,
        "auth_method": config.auth.method.value, "is_active": config.is_active,
        "events_received": config.events_received, "events_processed": config.events_processed,
        "last_event_at": config.last_event_at.isoformat() if config.last_event_at else None,
    }

@router.get("/webhooks/{webhook_id}/stats")
async def get_webhook_stats(webhook_id: str):
    return await _webhook_receiver.get_webhook_stats(webhook_id)

@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str):
    success = await _webhook_receiver.delete_webhook(webhook_id)
    if not success:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"success": True}

@router.post("/webhooks/{webhook_id}/rotate")
async def rotate_webhook_credentials(webhook_id: str):
    return {"success": True, "credentials": await _webhook_receiver.rotate_credentials(webhook_id)}

@router.post("/webhooks/{webhook_id}/receive")
async def receive_webhook(webhook_id: str, request: Dict[str, Any] = None):
    payload = json.dumps(request or {}).encode('utf-8')
    result = await _webhook_receiver.receive_event(
        webhook_id=webhook_id, payload=payload, headers={}, source_ip=None,
    )
    if not result.get("success"):
        raise HTTPException(status_code=result.get("code", 400), detail=result.get("error"))
    return result

@router.get("/webhooks/{webhook_id}/events")
async def get_webhook_events(webhook_id: str, status: Optional[str] = None, limit: int = 50):
    events = await _webhook_receiver.get_events(webhook_id=webhook_id, status=status, limit=limit)
    return {"events": events}


# ============== WEBHOOK EVENT PROCESSING ==============

@router.get("/events/stats")
async def get_event_stats():
    return await _event_processor.get_event_stats()

@router.post("/events/enqueue")
async def enqueue_event(event: dict):
    from webhook_processor import WebhookEvent
    evt = WebhookEvent(**event)
    event_id = await _event_processor.enqueue_event(evt)
    return {"success": True, "event_id": event_id}

@router.get("/events/dlq")
async def get_dlq_events(limit: int = 50):
    events = await _event_processor.get_dlq_events(limit)
    return {"events": events, "count": len(events)}

@router.post("/events/dlq/{event_id}/replay")
async def replay_dlq_event(event_id: str):
    success = await _event_processor.replay_dlq_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found in DLQ")
    return {"success": True, "message": "Event re-queued"}

@router.get("/events/types")
async def get_event_types():
    from webhook_processor import EventType
    return {"event_types": [e.value for e in EventType]}
