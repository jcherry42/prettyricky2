"""Authentication endpoints for federal-grade security"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import timedelta
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase

from security.auth import (
    create_access_token,
    hash_password,
    verify_password,
    get_current_user
)
from security.validation import validate_email, sanitize_input
from security.audit import AuditLogger
from security.rbac import Role, get_user_permissions

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/auth", tags=["authentication"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    role: Optional[str] = "sales_rep"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 1800  # 30 minutes
    user: dict

class UserResponse(BaseModel):
    user_id: str
    email: str
    first_name: str
    last_name: str
    role: str
    permissions: list

# Global references (set in server.py startup)
db: Optional[AsyncIOMotorDatabase] = None
audit_logger: Optional[AuditLogger] = None

def init_auth_router(database: AsyncIOMotorDatabase, audit: AuditLogger):
    """Initialize router with database and audit logger"""
    global db, audit_logger
    db = database
    audit_logger = audit

@auth_router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest, req: Request):
    """Register new user - FEDERAL SECURITY"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Validate email
    if not validate_email(request.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Check if user exists
    existing = await db.users.find_one({"email": request.email.lower()})
    if existing:
        # Security: Don't reveal user exists
        await audit_logger.log(
            action="auth.register.failed",
            details={"reason": "email_exists", "email": request.email},
            ip_address=req.client.host,
            status="failed"
        )
        raise HTTPException(status_code=400, detail="Registration failed")
    
    # Validate role
    try:
        user_role = Role(request.role)
    except ValueError:
        user_role = Role.SALES_REP  # Default role
    
    # Hash password
    hashed = hash_password(request.password)
    
    # Create user
    from uuid import uuid4
    from datetime import datetime, timezone
    
    user_id = str(uuid4())
    user = {
        "user_id": user_id,
        "email": request.email.lower(),
        "password_hash": hashed,
        "first_name": sanitize_input(request.first_name, max_length=50),
        "last_name": sanitize_input(request.last_name, max_length=50),
        "role": user_role.value,
        "created_at": datetime.now(timezone.utc),
        "is_active": True
    }
    
    await db.users.insert_one(user)
    
    # Audit log
    await audit_logger.log(
        action="auth.register",
        user_id=user_id,
        details={"email": request.email, "role": user_role.value},
        ip_address=req.client.host
    )
    
    # Create token
    token = create_access_token(
        data={
            "sub": user_id,
            "email": request.email,
            "role": user_role.value
        }
    )
    
    logger.info(f"User registered: {request.email}")
    
    return TokenResponse(
        access_token=token,
        user={
            "user_id": user_id,
            "email": request.email,
            "first_name": user["first_name"],
            "last_name": user["last_name"],
            "role": user_role.value,
            "permissions": [p.value for p in get_user_permissions(user_role.value)]
        }
    )

@auth_router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, req: Request):
    """Login user - FEDERAL SECURITY"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Find user
    user = await db.users.find_one({"email": request.email.lower()})
    
    if not user or not verify_password(request.password, user["password_hash"]):
        # Audit failed login
        await audit_logger.log(
            action="auth.login.failed",
            details={"email": request.email},
            ip_address=req.client.host,
            status="failed"
        )
        # Security: Don't reveal if user exists
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        await audit_logger.log(
            action="auth.login.inactive",
            user_id=user["user_id"],
            ip_address=req.client.host,
            status="failed"
        )
        raise HTTPException(status_code=403, detail="Account inactive")
    
    # Create token
    token = create_access_token(
        data={
            "sub": user["user_id"],
            "email": user["email"],
            "role": user["role"]
        }
    )
    
    # Audit successful login
    await audit_logger.log(
        action="auth.login",
        user_id=user["user_id"],
        ip_address=req.client.host,
        user_agent=req.headers.get('user-agent')
    )
    
    logger.info(f"User logged in: {user['email']}")
    
    return TokenResponse(
        access_token=token,
        user={
            "user_id": user["user_id"],
            "email": user["email"],
            "first_name": user.get("first_name", ""),
            "last_name": user.get("last_name", ""),
            "role": user["role"],
            "permissions": [p.value for p in get_user_permissions(user["role"])]
        }
    )

@auth_router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    if not db:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0, "password_hash": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserResponse(
        user_id=user["user_id"],
        email=user["email"],
        first_name=user.get("first_name", ""),
        last_name=user.get("last_name", ""),
        role=user["role"],
        permissions=[p.value for p in get_user_permissions(user["role"])]
    )

@auth_router.post("/logout")
async def logout(
    req: Request,
    current_user: dict = Depends(get_current_user)
):
    """Logout user (audit log only, token remains valid until expiry)"""
    await audit_logger.log(
        action="auth.logout",
        user_id=current_user["user_id"],
        ip_address=req.client.host
    )
    
    return {"message": "Logged out successfully"}