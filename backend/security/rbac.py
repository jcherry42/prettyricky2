"""Role-Based Access Control for federal compliance"""
from enum import Enum
from typing import List, Optional
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

class Role(str, Enum):
    """User roles"""
    ADMIN = "admin"
    MANAGER = "manager"
    SALES_REP = "sales_rep"
    VIEWER = "viewer"

class Permission(str, Enum):
    """Granular permissions"""
    # Customer permissions
    CUSTOMER_CREATE = "customer.create"
    CUSTOMER_READ = "customer.read"
    CUSTOMER_UPDATE = "customer.update"
    CUSTOMER_DELETE = "customer.delete"
    
    # Vehicle permissions
    VEHICLE_CREATE = "vehicle.create"
    VEHICLE_READ = "vehicle.read"
    VEHICLE_UPDATE = "vehicle.update"
    VEHICLE_DELETE = "vehicle.delete"
    
    # AI/Tower Talk permissions
    AI_GENERATE = "ai.generate"
    AI_TRANSLATE = "ai.translate"
    
    # Analytics permissions
    ANALYTICS_VIEW = "analytics.view"
    ANALYTICS_EXPORT = "analytics.export"
    
    # Admin permissions
    ADMIN_SETTINGS = "admin.settings"
    ADMIN_USERS = "admin.users"
    ADMIN_AUDIT = "admin.audit"

# Role-Permission mapping (Federal-grade least privilege)
ROLE_PERMISSIONS = {
    Role.ADMIN: [p for p in Permission],  # All permissions
    Role.MANAGER: [
        Permission.CUSTOMER_READ,
        Permission.CUSTOMER_UPDATE,
        Permission.VEHICLE_READ,
        Permission.VEHICLE_UPDATE,
        Permission.AI_GENERATE,
        Permission.AI_TRANSLATE,
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
    ],
    Role.SALES_REP: [
        Permission.CUSTOMER_READ,
        Permission.CUSTOMER_CREATE,
        Permission.CUSTOMER_UPDATE,
        Permission.VEHICLE_READ,
        Permission.AI_GENERATE,
        Permission.AI_TRANSLATE,
    ],
    Role.VIEWER: [
        Permission.CUSTOMER_READ,
        Permission.VEHICLE_READ,
        Permission.ANALYTICS_VIEW,
    ],
}

def has_permission(user_role: str, required_permission: Permission) -> bool:
    """Check if user role has required permission"""
    try:
        role = Role(user_role)
        permissions = ROLE_PERMISSIONS.get(role, [])
        return required_permission in permissions
    except ValueError:
        logger.warning(f"Invalid role: {user_role}")
        return False

def require_permission(required_permission: Permission):
    """Decorator to require specific permission"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Get current_user from kwargs (injected by Depends)
            current_user = kwargs.get('current_user')
            
            if not current_user:
                raise HTTPException(
                    status_code=401,
                    detail="Authentication required"
                )
            
            user_role = current_user.get('role', 'viewer')
            
            if not has_permission(user_role, required_permission):
                logger.warning(
                    f"Permission denied: {current_user.get('user_id')} "
                    f"tried to access {required_permission}"
                )
                raise HTTPException(
                    status_code=403,
                    detail="Insufficient permissions"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def get_user_permissions(user_role: str) -> List[Permission]:
    """Get all permissions for a user role"""
    try:
        role = Role(user_role)
        return ROLE_PERMISSIONS.get(role, [])
    except ValueError:
        return []