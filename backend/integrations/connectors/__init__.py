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
- Tekion
- PBS Systems
- AutoMate DMS
- Frazer DMS
- Wayne Reaves
- AutoManager
- DealerCenter
"""

from .vinsolutions import VinSolutionsAdapter
from .dealersocket import DealerSocketAdapter
from .elead import EleadAdapter
from .cdk import CDKAdapter
from .dealertrack import DealerTrackAdapter
from .reynolds import ReynoldsAdapter
from .promax import ProMaxAdapter
from .tekion import TekionAdapter
from .pbs import PBSAdapter
from .automate import AutoMateAdapter
from .frazer import FrazerAdapter

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
    'TekionAdapter',
    'PBSAdapter',
    
    # Tier 3 - Specialized
    'AutoMateAdapter',
    'FrazerAdapter',
]

# Connector metadata for UI
CONNECTORS = {
    "vinsolutions": {
        "name": "VinSolutions Connect CRM",
        "vendor": "Cox Automotive",
        "tier": 1,
        "description": "Full-featured CRM with lead management, inventory, and desking",
    },
    "dealersocket": {
        "name": "DealerSocket CRM",
        "vendor": "Solera",
        "tier": 1,
        "description": "Comprehensive CRM with equity mining and service scheduling",
    },
    "elead": {
        "name": "elead CRM",
        "vendor": "CDK Global",
        "tier": 1,
        "description": "Lead scoring, customer database, and desking tools",
    },
    "cdk": {
        "name": "CDK Drive / CDK Global",
        "vendor": "CDK Global",
        "tier": 1,
        "description": "Enterprise DMS with full dealership management",
    },
    "dealertrack": {
        "name": "DealerTrack DMS",
        "vendor": "Cox Automotive",
        "tier": 1,
        "description": "DMS with F&I and credit application processing",
    },
    "reynolds": {
        "name": "Reynolds & Reynolds ERA-IGNITE",
        "vendor": "Reynolds & Reynolds",
        "tier": 1,
        "description": "Full DMS with document management and compliance",
    },
    "promax": {
        "name": "ProMax Unlimited",
        "vendor": "ProMax",
        "tier": 2,
        "description": "CRM, desking, and F&I in one platform",
    },
    "tekion": {
        "name": "Tekion Automotive Retail Cloud",
        "vendor": "Tekion",
        "tier": 2,
        "description": "Modern cloud-native DMS and CRM platform",
    },
    "pbs": {
        "name": "PBS Systems DMS",
        "vendor": "PBS Systems",
        "tier": 2,
        "description": "Canadian and US dealer management system",
    },
    "automate": {
        "name": "AutoMate DMS",
        "vendor": "Auto/Mate",
        "tier": 3,
        "description": "Independent dealer management system",
    },
    "frazer": {
        "name": "Frazer DMS",
        "vendor": "Frazer Computing",
        "tier": 3,
        "description": "BHPH and independent dealer management",
    },
}
