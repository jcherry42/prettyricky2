"""
Webhook Receiver System
Handles incoming webhooks from CRM systems for real-time updates
"""

from .receiver import WebhookReceiver, WebhookConfig, WebhookEvent
from .handlers import WebhookHandlerRegistry, BaseWebhookHandler

__all__ = [
    'WebhookReceiver',
    'WebhookConfig',
    'WebhookEvent',
    'WebhookHandlerRegistry',
    'BaseWebhookHandler',
]
