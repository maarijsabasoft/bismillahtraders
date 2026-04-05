/**
 * Notify other tabs / same app that Mongo (or remote) data changed so UIs can refetch.
 * BroadcastChannel when available; localStorage fallback for older browsers.
 */

const CHANNEL_NAME = 'bismillah-traders-db-sync-v1';
const LS_KEY = 'bth_db_data_revision';

let channel = null;

function getChannel() {
  if (typeof window === 'undefined') return null;
  if (channel) return channel;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
    }
  } catch {
    channel = null;
  }
  return channel;
}

/**
 * Call after successful remote DB mutations (from database-mongodb run).
 */
export function emitDataMutation(meta = {}) {
  if (typeof window === 'undefined') return;
  const payload = { t: Date.now(), ...meta };
  // Same document/tab: storage events do not fire for the tab that called setItem, and
  // some environments are flaky with BroadcastChannel self-delivery — always dispatch locally.
  try {
    window.dispatchEvent(new CustomEvent('bismillah-traders-db-changed', { detail: payload }));
  } catch {
    /* ignore */
  }
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage(payload);
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.setItem(LS_KEY, String(payload.t));
  } catch {
    /* ignore */
  }
}

/**
 * Subscribe to cross-tab (and same-tab BC) data change notifications.
 * @returns {() => void} unsubscribe
 */
export function subscribeDataMutation(handler) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const onMessage = (ev) => {
    try {
      handler(ev?.data && typeof ev.data === 'object' ? ev.data : { t: Date.now() });
    } catch {
      handler({ t: Date.now() });
    }
  };

  const ch = getChannel();
  if (ch) {
    ch.addEventListener('message', onMessage);
  }

  const onStorage = (e) => {
    if (e.key !== LS_KEY || e.newValue == null) return;
    const t = parseInt(e.newValue, 10);
    handler({ t: Number.isFinite(t) ? t : Date.now(), viaStorage: true });
  };
  window.addEventListener('storage', onStorage);

  return () => {
    if (ch) {
      ch.removeEventListener('message', onMessage);
    }
    window.removeEventListener('storage', onStorage);
  };
}
