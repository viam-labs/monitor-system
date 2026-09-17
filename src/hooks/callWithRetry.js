import { isNotConnectedError, markRpcSuccess, reportRpcError } from '../lib/connectionHealth';

// Retry reads on "not connected" errors — the underlying WebRTC data
// channel sometimes isn't fully ready on the first RPC after a fresh
// page load, especially on mobile. Callers should only wrap reads;
// mutations shouldn't retry to avoid duplicate side effects on
// ambiguous failures.
export async function callWithRetry(fn, { retries = 2, delayMs = 800 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn();
      markRpcSuccess();
      return result;
    } catch (e) {
      lastError = e;
      if (!isNotConnectedError(e) || attempt === retries) {
        if (isNotConnectedError(e)) reportRpcError(e);
        throw e;
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
