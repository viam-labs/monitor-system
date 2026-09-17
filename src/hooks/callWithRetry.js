// Retry reads on "not connected" errors — the underlying WebRTC data
// channel sometimes isn't fully ready on the first RPC after a fresh
// page load, especially on mobile. Callers should only wrap reads;
// mutations shouldn't retry to avoid duplicate side effects on
// ambiguous failures.
export async function callWithRetry(fn, { retries = 2, delayMs = 800 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const msg = (e?.message || String(e)).toLowerCase();
      if (!msg.includes('not connected') || attempt === retries) throw e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}
