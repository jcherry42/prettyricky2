/**
 * Lightweight module-scoped event bus.
 * Replaces globalThis.__ patterns with a clean pub/sub API.
 * Each event name maps to a single handler (latest wins).
 */
const _handlers = {};

export function on(event, handler) {
  _handlers[event] = handler;
  // Return unsubscribe function for useEffect cleanup
  return () => {
    if (_handlers[event] === handler) {
      delete _handlers[event];
    }
  };
}

export function emit(event, ...args) {
  _handlers[event]?.(...args);
}
