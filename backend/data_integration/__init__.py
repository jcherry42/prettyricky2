"""
CRM-Agnostic Data Integration Package

A robust, production-ready data integration system that:
- Supports CSV, JSON, and Google Sheets
- Auto-detects field mappings with confidence scores
- Validates and normalizes data (phone, email, VIN, etc.)
- Schedules periodic refreshes (Mon-Sat 10 AM)
- Provides health monitoring and error recovery

Usage:
    from data_integration import ImportProcessor, init_scheduler

    # One-time import
    processor = ImportProcessor()
    result = await processor.import_from_url(url, "customers")

    # Start scheduled refreshes
    scheduler = await init_scheduler(db)
"""

from .models import (
    Customer,
    Vehicle,
    DataSourceConfig,
    ImportResult,
    LeadStatus,
    VehicleStatus,
    DataSourceType,
    RefreshSchedule,
)
from .processor import ImportProcessor
from .field_mapper import SmartFieldMapper
from .scheduler import init_scheduler, get_scheduler, shutdown_scheduler
from .exceptions import (
    DataIntegrationError,
    ParseError,
    ValidationError,
    MappingError,
    FetchError,
    TransformError,
)

__all__ = [
    # Models
    'Customer',
    'Vehicle',
    'DataSourceConfig',
    'ImportResult',
    'LeadStatus',
    'VehicleStatus',
    'DataSourceType',
    'RefreshSchedule',
    # Processor
    'ImportProcessor',
    'SmartFieldMapper',
    # Scheduler
    'init_scheduler',
    'get_scheduler',
    'shutdown_scheduler',
    # Exceptions
    'DataIntegrationError',
    'ParseError',
    'ValidationError',
    'MappingError',
    'FetchError',
    'TransformError',
]
