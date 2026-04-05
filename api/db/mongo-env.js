/**
 * Server-only MongoDB settings from environment (Vercel, vercel dev, etc.).
 * MONGODB_URI must never be prefixed with REACT_APP_ — it must stay on the server.
 */

export function getMongoUri() {
  const raw = process.env.MONGODB_URI;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  return String(raw).trim();
}

export function getMongoDbNameFromEnv() {
  return (process.env.MONGODB_DB_NAME || 'bismillah_traders').trim();
}

/** Prefer database name from URI path; otherwise MONGODB_DB_NAME / default. */
export function getResolvedMongoDbName(uri) {
  const match = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^/?]+)/);
  if (match && match[2]) return match[2];
  return getMongoDbNameFromEnv();
}

function isVercelServerless() {
  return process.env.VERCEL === '1';
}

/**
 * Driver timeouts for serverless: Vercel Hobby ~10s function cap — long serverSelection waits → 504.
 * Override with MONGODB_SERVER_SELECTION_MS, MONGODB_CONNECT_MS, MONGODB_SOCKET_MS.
 */
export function getMongoDriverTimeouts() {
  const onVercel = isVercelServerless();
  const serverSelectionTimeoutMS = Number(process.env.MONGODB_SERVER_SELECTION_MS) || (onVercel ? 7000 : 45000);
  const connectTimeoutMS = Number(process.env.MONGODB_CONNECT_MS) || (onVercel ? 7000 : 45000);
  const socketTimeoutMS = Number(process.env.MONGODB_SOCKET_MS) || (onVercel ? 10000 : 60000);
  return { serverSelectionTimeoutMS, connectTimeoutMS, socketTimeoutMS };
}

/**
 * Omit (default) for normal OS DNS / dual-stack. Set MONGODB_DNS_FAMILY=4 or 6 only if Atlas/network docs require it.
 * Forcing IPv4 has been linked to intermittent TLS "alert 80" on some Vercel ↔ Atlas routes.
 */
export function getMongoDnsFamily() {
  const v = process.env.MONGODB_DNS_FAMILY;
  if (v === undefined || v === null || String(v).trim() === '') return undefined;
  const n = Number(String(v).trim());
  if (n === 4 || n === 6) return n;
  return undefined;
}

export function isVercelRuntime() {
  return isVercelServerless();
}

/**
 * Reusing a pooled client across frozen Vercel invocations often triggers TLS "alert 80".
 * Default on Vercel: new client per request (slower, reliable). Set MONGODB_REUSE_CLIENT=1 to opt into cache.
 */
export function useRequestScopedMongoClient() {
  if (!isVercelServerless()) return false;
  return process.env.MONGODB_REUSE_CLIENT !== '1';
}
