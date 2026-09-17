// Tiny pubsub for surfacing "the Viam RPC channel is dead" from any
// hook up to the MachinePage banner. Hooks call handleRpcError(e) in
// their catch blocks; on success they don't need to do anything —
// callWithRetry (and mutations that follow with refresh) clear it
// automatically once an RPC round-trips again.

let lost = false;
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn(lost);
}

export function subscribeConnectionHealth(fn) {
  listeners.add(fn);
  fn(lost);
  return () => listeners.delete(fn);
}

export function reportRpcError(err) {
  if (!isNotConnectedError(err)) return;
  if (lost) return;
  lost = true;
  notify();
}

export function markRpcSuccess() {
  if (!lost) return;
  lost = false;
  notify();
}

export function isNotConnectedError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return msg.includes('not connected');
}

// Returns true iff the error was a "not connected" — callers can use
// this to skip setError since the top-level banner already covers it.
export function handleRpcError(err) {
  if (!isNotConnectedError(err)) return false;
  reportRpcError(err);
  return true;
}
