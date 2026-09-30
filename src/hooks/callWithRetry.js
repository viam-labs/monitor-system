import { isNotConnectedError, markRpcSuccess, reportRpcError } from '../lib/connectionHealth';

// Reads only — mutations shouldn't retry to avoid duplicate side effects
// on ambiguous failures. Handles the WebRTC-not-ready-yet race on first RPC.
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
