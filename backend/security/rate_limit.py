"""Rate limiting middleware for DDoS protection"""
import time
from collections import defaultdict
from typing import Dict, Tuple
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware - Federal grade"""
    
    def __init__(self, app, requests_per_minute: int = 60, burst_size: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.clients: Dict[str, Tuple[list, int]] = defaultdict(lambda: ([], 0))
        
    async def dispatch(self, request: Request, call_next):
        # Get client identifier (IP + User-Agent for better uniqueness)
        client_ip = request.client.host
        user_agent = request.headers.get('user-agent', 'unknown')
        client_id = f"{client_ip}:{hash(user_agent)}"
        
        # Check rate limit
        current_time = time.time()
        requests, burst_count = self.clients[client_id]
        
        # Remove old requests (older than 1 minute)
        requests = [req_time for req_time in requests if current_time - req_time < 60]
        
        # Check burst limit
        recent_requests = [req_time for req_time in requests if current_time - req_time < 1]
        if len(recent_requests) >= self.burst_size:
            logger.warning(f'Rate limit burst exceeded for {client_ip}')
            raise HTTPException(
                status_code=429,
                detail='Too many requests. Please slow down.'
            )
        
        # Check per-minute limit
        if len(requests) >= self.requests_per_minute:
            logger.warning(f'Rate limit exceeded for {client_ip}')
            raise HTTPException(
                status_code=429,
                detail='Rate limit exceeded. Try again in 60 seconds.'
            )
        
        # Add current request
        requests.append(current_time)
        self.clients[client_id] = (requests, burst_count + 1)
        
        # Clean up old clients (memory management)
        if burst_count % 100 == 0:
            self._cleanup_old_clients(current_time)
        
        response = await call_next(request)
        return response
    
    def _cleanup_old_clients(self, current_time: float):
        """Remove clients with no requests in last 5 minutes"""
        to_remove = []
        for client_id, (requests, _) in self.clients.items():
            if not requests or current_time - requests[-1] > 300:
                to_remove.append(client_id)
        
        for client_id in to_remove:
            del self.clients[client_id]

def rate_limit_middleware(app, rpm: int = 60, burst: int = 100):
    """Add rate limiting middleware to app"""
    return RateLimitMiddleware(app, rpm, burst)