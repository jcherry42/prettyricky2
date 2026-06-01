/**
 * WebSocketContext — Real-time communication layer
 *
 * Manages a persistent WebSocket connection with:
 *  - Auto-reconnect with exponential backoff
 *  - Channel subscription model
 *  - Event listener registration (type-safe)
 *  - Connection health monitoring (heartbeat ping)
 *  - Graceful AppState handling (disconnect on background, reconnect on foreground)
 *
 * Usage:
 *   const { connected, subscribe, send } = useWebSocket();
 *   useEffect(() => subscribe('print_status', (data) => { ... }), []);
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { buildApiUrlAsync } from '../config/backend';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WsMessage {
  event: string;
  data: any;
  ts: string;
}

type WsEventHandler = (data: any) => void;

interface WebSocketContextValue {
  connected: boolean;
  activeClients: number;
  subscribe: (event: string, handler: WsEventHandler) => () => void;
  send: (action: string, payload?: Record<string, any>) => void;
  joinChannel: (channel: string) => void;
  leaveChannel: (channel: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ─── Constants ──────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL = 25_000;       // ping every 25s
const RECONNECT_MIN_DELAY = 1_000;       // 1s
const RECONNECT_MAX_DELAY = 30_000;      // 30s cap
const DEFAULT_CHANNELS = ['general', 'print_status', 'scans'];

// ─── Provider ───────────────────────────────────────────────────────────────

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [activeClients, setActiveClients] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<WsEventHandler>>>(new Map());
  const reconnectDelay = useRef(RECONNECT_MIN_DELAY);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // ── Build WS URL ──
  const getWsUrl = useCallback(async (): Promise<string | null> => {
    try {
      const httpUrl = await buildApiUrlAsync('/api/ws');
      if (!httpUrl) return null;
      const wsUrl = httpUrl
        .replace(/^https:\/\//, 'wss://')
        .replace(/^http:\/\//, 'ws://');
      return `${wsUrl}?channels=${DEFAULT_CHANNELS.join(',')}`;
    } catch {
      return null;
    }
  }, []);

  // ── Dispatch event to listeners ──
  const dispatch = useCallback((event: string, data: any) => {
    const handlers = listenersRef.current.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try { h(data); } catch (e: any) { console.warn('[WS] Handler error:', e); }
      });
    }
    // Also dispatch to wildcard '*' listeners
    const wildcards = listenersRef.current.get('*');
    if (wildcards) {
      wildcards.forEach((h) => {
        try { h({ event, data }); } catch { /* ignore */ }
      });
    }
  }, []);

  // ── Start heartbeat ──
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  // ── Stop heartbeat ──
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) {
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    }
  }, []);

  // ── Connect ──
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const url = await getWsUrl();
    if (!url) {
      // Retry later
      reconnectTimer.current = setTimeout(() => {
        if (isMounted.current) connect();
      }, reconnectDelay.current);
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted.current) return;
        setConnected(true);
        reconnectDelay.current = RECONNECT_MIN_DELAY;
        startHeartbeat();
        dispatch('ws_connected', {});
      };

      ws.onmessage = (e: MessageEvent) => {
        if (!isMounted.current) return;
        try {
          const msg: WsMessage = JSON.parse(e.data);
          // Track pong for active client count
          if (msg.event === 'pong' && msg.data?.active_clients != null) {
            setActiveClients(msg.data.active_clients);
          }
          dispatch(msg.event, msg.data);
        } catch {
          // Non-JSON message, ignore
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnection
      };

      ws.onclose = () => {
        if (!isMounted.current) return;
        setConnected(false);
        stopHeartbeat();
        dispatch('ws_disconnected', {});

        // Exponential backoff reconnect
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(delay * 2, RECONNECT_MAX_DELAY);
        reconnectTimer.current = setTimeout(() => {
          if (isMounted.current && appStateRef.current === 'active') {
            connect();
          }
        }, delay);
      };
    } catch {
      // Schedule reconnect
      reconnectTimer.current = setTimeout(() => {
        if (isMounted.current) connect();
      }, reconnectDelay.current);
    }
  }, [getWsUrl, startHeartbeat, stopHeartbeat, dispatch]);

  // ── Disconnect ──
  const disconnect = useCallback(() => {
    stopHeartbeat();
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnect
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, [stopHeartbeat]);

  // ── AppState handling ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev.match(/inactive|background/) && nextState === 'active') {
        // Returning to foreground — reconnect
        connect();
      } else if (nextState.match(/inactive|background/)) {
        // Going to background — disconnect cleanly
        disconnect();
      }
    });

    return () => sub.remove();
  }, [connect, disconnect]);

  // ── Mount/unmount ──
  useEffect(() => {
    isMounted.current = true;
    connect();
    return () => {
      isMounted.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  // ── Public API ──

  const subscribe = useCallback((event: string, handler: WsEventHandler): (() => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);

    return () => {
      listenersRef.current.get(event)?.delete(handler);
      if (listenersRef.current.get(event)?.size === 0) {
        listenersRef.current.delete(event);
      }
    };
  }, []);

  const send = useCallback((action: string, payload: Record<string, any> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...payload }));
    }
  }, []);

  const joinChannel = useCallback((channel: string) => {
    send('subscribe', { channel });
  }, [send]);

  const leaveChannel = useCallback((channel: string) => {
    send('unsubscribe', { channel });
  }, [send]);

  const value = useMemo<WebSocketContextValue>(() => ({
    connected,
    activeClients,
    subscribe,
    send,
    joinChannel,
    leaveChannel,
  }), [connected, activeClients, subscribe, send, joinChannel, leaveChannel]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used within WebSocketProvider');
  return ctx;
}
