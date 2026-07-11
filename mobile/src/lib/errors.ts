/**
 * Error helpers — safely narrow `unknown` from catch blocks.
 *
 *   try {
 *     await doThing();
 *   } catch (e: unknown) {
 *     toast.showError(errorMessage(e));
 *     if (errorCode(e) === 'TIMEOUT') retry();
 *   }
 */

interface CaughtError {
  message?: string;
  code?: string;
}

function asError(e: unknown): CaughtError {
  if (e && typeof e === 'object') return e as CaughtError;
  return {};
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  const m = asError(e).message;
  if (m) return String(m);
  return String(e);
}

export function errorCode(e: unknown): string | undefined {
  return asError(e).code;
}

/** Test whether the error looks like a network/timeout error from apiFetch. */
export function isNetworkError(e: unknown): boolean {
  const c = errorCode(e);
  if (c === 'TIMEOUT' || c === 'NETWORK') return true;
  const m = errorMessage(e);
  return /network|timeout|fetch failed|abort/i.test(m);
}
