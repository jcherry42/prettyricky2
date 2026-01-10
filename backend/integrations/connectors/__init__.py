"""
Fortified Automotive CRM Connectors
Pre-built adapters for all major automotive CRM systems

Includes:
- VinSolutions (Cox Automotive)
- DealerSocket (Solera)
- elead CRM (CDK Global)
- CDK Global / CDK Drive
- DealerTrack (Cox Automotive)
- Reynolds & Reynolds
- ProMax Unlimited
"""

from .vinsolutions import VinSolutionsAdapter
from .dealersocket import DealerSocketAdapter
from .elead import EleadAdapter
from .cdk import CDKAdapter
from .dealertrack import DealerTrackAdapter
from .reynolds import ReynoldsAdapter
from .promax import ProMaxAdapter

__all__ = [
    # Tier 1 - Major Players
    'VinSolutionsAdapter',
    'DealerSocketAdapter', 
    'EleadAdapter',
    'CDKAdapter',
    'DealerTrackAdapter',
    'ReynoldsAdapter',
    
    # Tier 2 - Popular
    'ProMaxAdapter',
]

# Connector metadata for UI
CONNECTORS = {
    "vinsolutions": {
        "name": "VinSolutions Connect CRM",
        "vendor": "Cox Automotive",
        "tier": 1,
        "description": "Full-featured CRM with lead management, inventory, and desking",
        "authMethods": ["api_key", "oauth2"],
        "logo": "vinsolutions",
    },
    "dealersocket": {
        "name": "DealerSocket CRM",
        "vendor": "Solera",
        "tier": 1,
        "description": "Comprehensive CRM with equity mining and service scheduling",
        "authMethods": ["api_key", "oauth2"],
        "logo": "dealersocket",
    },
    "elead": {
        "name": "elead CRM",
        "vendor": "CDK Global",
        "tier": 1,
        "description": "Lead scoring, customer database, and desking tools",
        "authMethods": ["api_key"],
        "logo": "elead",
    },
    "cdk": {
        "name": "CDK Drive / CDK Global",
        "vendor": "CDK Global",
        "tier": 1,
        "description": "Enterprise DMS with full dealership management",
        "authMethods": ["oauth2"],
        "logo": "cdk",
    },
    "dealertrack": {
        "name": "DealerTrack DMS",
        "vendor": "Cox Automotive",
        "tier": 1,
        "description": "DMS with F&I and credit application processing",
        "authMethods": ["oauth2"],
        "logo": "dealertrack",
    },
    "reynolds": {
        "name": "Reynolds & Reynolds ERA-IGNITE",
        "vendor": "Reynolds & Reynolds",
        "tier": 1,
        "description": "Full DMS with document management and compliance",
        "authMethods": ["api_key"],
        "logo": "reynolds",
    },
    "promax": {
        "name": "ProMax Unlimited",
        "vendor": "ProMax",
        "tier": 2,
        "description": "CRM, desking, and F&I in one platform",
        "authMethods": ["api_key"],
        "logo": "promax",
    },
    "generic_rest": {
        "name": "Generic REST API",
        "vendor": "Custom",
        "tier": 3,
        "description": "Connect to any REST API with configurable endpoints",
        "authMethods": ["api_key", "bearer_token", "basic_auth", "oauth2", "custom_header"],
        "logo": "api",
    },
}
