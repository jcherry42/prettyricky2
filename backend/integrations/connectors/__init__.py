"""
Automotive CRM Connectors
Pre-built adapters for popular automotive CRM systems
"""

from .vinsolutions import VinSolutionsAdapter
from .dealersocket import DealerSocketAdapter
from .elead import EleadAdapter
from .cdk import CDKAdapter
from .dealertrack import DealerTrackAdapter
from .reynolds import ReynoldsAdapter
from .promax import ProMaxAdapter

__all__ = [
    'VinSolutionsAdapter',
    'DealerSocketAdapter', 
    'EleadAdapter',
    'CDKAdapter',
    'DealerTrackAdapter',
    'ReynoldsAdapter',
    'ProMaxAdapter',
]
