/**
 * Lightweight module-scoped event bus (TypeScript template).
 * Replaces globalThis.__ patterns with a clean pub/sub API.
 *
 * This is the TypeScript reference implementation — demonstrates
 * the migration pattern for converting .js → .ts files.
 *
 * Type-safe event definitions:
 *   type AppEvents = {
 *     openNewCustomer: () => void;
 *     vinScanned: (vin: string) => void;
 *     licenseScanned: (data: LicenseData) => void;
 *   };
 */

type EventHandler = (...args: unknown[]) => void;

const _handlers: Record<string, EventHandler> = {};

/**
 * Subscribe to an event. Returns an unsubscribe function for useEffect cleanup.
 *
 * @example
 * useEffect(() => on('openNewCustomer', handleAddNew), [handleAddNew]);
 */
export function on(event: string, handler: EventHandler): () => void {
  _handlers[event] = handler;
  return () => {
    if (_handlers[event] === handler) {
      delete _handlers[event];
    }
  };
}

/**
 * Emit an event, calling the registered handler if any.
 *
 * @example
 * emit('openNewCustomer');
 * emit('vinScanned', '1HGBH41JXMN109186');
 */
export function emit(event: string, ...args: unknown[]): void {
  _handlers[event]?.(...args);
}
