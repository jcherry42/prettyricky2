"""WebSocket manager and endpoint — extracted from server.py."""

from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime, timezone
import asyncio
import json
import logging
from typing import Set

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections with channel support."""

    def __init__(self):
        self._connections: Set[WebSocket] = set()
        self._channels: dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, channels: list[str] | None = None):
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
            for ch in (channels or ["general"]):
                if ch not in self._channels:
                    self._channels[ch] = set()
                self._channels[ch].add(ws)
        logger.info(f"[WS] Client connected. Total: {len(self._connections)}")

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self._connections.discard(ws)
            for ch_set in self._channels.values():
                ch_set.discard(ws)
        logger.info(f"[WS] Client disconnected. Total: {len(self._connections)}")

    async def broadcast(self, event: str, data: dict, channel: str = "general"):
        payload = json.dumps({"event": event, "data": data, "ts": datetime.now(timezone.utc).isoformat()})
        async with self._lock:
            targets = list(self._channels.get(channel, set()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

    async def send_personal(self, ws: WebSocket, event: str, data: dict):
        try:
            await ws.send_text(json.dumps({"event": event, "data": data, "ts": datetime.now(timezone.utc).isoformat()}))
        except Exception:
            await self.disconnect(ws)

    @property
    def active_count(self) -> int:
        return len(self._connections)


# Singleton instance
ws_manager = ConnectionManager()


def register_websocket_route(app):
    """Register the WebSocket endpoint directly on the FastAPI app instance."""

    @app.websocket("/api/ws")
    async def websocket_endpoint(websocket: WebSocket):
        """Main WebSocket endpoint.

        Query params:
          ?channels=general,print_status,scans  (comma-separated channel list)

        Client messages:
          {"action": "ping"}                       -> responds with pong
          {"action": "subscribe", "channel": "x"}  -> joins channel x
          {"action": "unsubscribe", "channel": "x"}
        """
        channels_param = websocket.query_params.get("channels", "general")
        channels = [c.strip() for c in channels_param.split(",") if c.strip()]

        await ws_manager.connect(websocket, channels)
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    await ws_manager.send_personal(websocket, "error", {"message": "Invalid JSON"})
                    continue

                action = msg.get("action", "")

                if action == "ping":
                    await ws_manager.send_personal(websocket, "pong", {"active_clients": ws_manager.active_count})
                elif action == "subscribe":
                    ch = msg.get("channel", "general")
                    async with ws_manager._lock:
                        if ch not in ws_manager._channels:
                            ws_manager._channels[ch] = set()
                        ws_manager._channels[ch].add(websocket)
                    await ws_manager.send_personal(websocket, "subscribed", {"channel": ch})
                elif action == "unsubscribe":
                    ch = msg.get("channel", "")
                    async with ws_manager._lock:
                        if ch in ws_manager._channels:
                            ws_manager._channels[ch].discard(websocket)
                    await ws_manager.send_personal(websocket, "unsubscribed", {"channel": ch})
                else:
                    await ws_manager.send_personal(websocket, "ack", {"action": action})

        except WebSocketDisconnect:
            await ws_manager.disconnect(websocket)
        except Exception as e:
            logger.warning(f"[WS] Error: {e}")
            await ws_manager.disconnect(websocket)
