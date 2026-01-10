"""
Webhook Receiver System
Handles incoming webhooks from CRM systems for real-time updates

Features:
- Multiple authentication methods (HMAC, API Key, Bearer Token, IP Whitelist)
- Replay attack prevention
- Idempotency support
- Rate limiting
- Comprehensive audit logging
"""

from .receiver import WebhookReceiver, WebhookConfig, WebhookEvent
from .handlers import WebhookHandlerRegistry, BaseWebhookHandler
from .fortified_receiver import (
    FortifiedWebhookReceiver,
    WebhookAuthMethod,
    WebhookAuthConfig,
    WebhookEventType,
    verify_hmac_signature,
    verify_api_key,
    verify_bearer_token,
)

__all__ = [
    # Legacy receiver (for backwards compatibility)
    'WebhookReceiver',
    'WebhookConfig',
    'WebhookEvent',
    'WebhookHandlerRegistry',
    'BaseWebhookHandler',
    # Fortified receiver
    'FortifiedWebhookReceiver',
    'WebhookAuthMethod',
    'WebhookAuthConfig',
    'WebhookEventType',
    'verify_hmac_signature',
    'verify_api_key',
    'verify_bearer_token',
]
