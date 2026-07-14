"""
Structured logging configuration.

When LOG_FORMAT=json (production), all log lines are emitted as newline-
delimited JSON with timestamp, level, logger name, message, and any extra
fields the caller attached via `logger.info(..., extra={...})`. Compatible
with any log aggregator (Datadog, Loki, CloudWatch, Splunk).

When LOG_FORMAT is unset or "text" (dev default), we keep the classic
human-readable formatter — no behavior change.

Usage (already handled centrally in server.py):
    from lib.logging_config import configure_logging
    configure_logging()

    logger = logging.getLogger(__name__)
    logger.info("user_action", extra={"user_id": "abc", "action": "login"})
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Optional


_TEXT_FORMAT = '%(asctime)s [%(levelname)s] %(name)s: %(message)s'


def configure_logging(level: Optional[str] = None) -> None:
    """Configure the root logger once at server startup.

    Idempotent: safe to call multiple times; wipes existing handlers first
    so `logging.basicConfig` calls elsewhere don't double-wire the stream.
    """
    log_level = (level or os.environ.get('LOG_LEVEL') or 'INFO').upper()
    log_format = (os.environ.get('LOG_FORMAT') or 'text').lower()

    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)

    if log_format == 'json':
        try:
            from pythonjsonlogger import jsonlogger
            fmt = jsonlogger.JsonFormatter(
                '%(asctime)s %(name)s %(levelname)s %(message)s',
                rename_fields={
                    'asctime': 'timestamp',
                    'levelname': 'level',
                    'name': 'logger',
                },
            )
            handler.setFormatter(fmt)
        except ImportError:
            # Fallback if the library isn't installed — never break startup.
            handler.setFormatter(logging.Formatter(_TEXT_FORMAT))
    else:
        handler.setFormatter(logging.Formatter(_TEXT_FORMAT))

    root.addHandler(handler)
    root.setLevel(log_level)

    # Quiet noisy dependencies unless explicitly overridden
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('multipart.multipart').setLevel(logging.WARNING)
