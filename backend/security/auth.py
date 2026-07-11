"""JWT Authentication for federal-level security"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
import logging

logger = logging.getLogger(__name__)

# Security configuration — fail fast if JWT secret is not set
SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not SECRET_KEY:
    # Generate a random key for development — MUST be set explicitly in production
    import secrets as _secrets
    SECRET_KEY = _secrets.token_hex(32)
    logger.warning("JWT_SECRET_KEY not set — using auto-generated key (sessions will not survive restarts)")
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token with iat + unique jti so consecutive
    tokens are guaranteed distinct (needed for correct rotation semantics)."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        'exp': expire,
        'iat': now,
        'jti': uuid.uuid4().hex,
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> dict:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f'Token verification failed: {str(e)}')
        raise HTTPException(
            status_code=401,
            detail='Invalid authentication credentials',
            headers={'WWW-Authenticate': 'Bearer'},
        )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    payload = verify_token(token)
    
    user_id = payload.get('sub')
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail='Invalid authentication credentials'
        )
    
    return {
        'user_id': user_id,
        'email': payload.get('email'),
        'role': payload.get('role', 'user')
    }

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)