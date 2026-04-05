/**
 * Server-only MongoDB settings from environment (Vercel, vercel dev, etc.).
 * MONGODB_URI must never be prefixed with REACT_APP_ — it must stay on the server.
 */

import dns from 'node:dns';

/** Ensure Atlas-friendly defaults without duplicating keys. */
function normalizeMongoConnectionString(uri) {
  const u = String(uri).trim();
  const q = u.indexOf('?');
  const base = q === -1 ? u : u.slice(0, q);
  const existing = q === -1 ? '' : u.slice(q + 1);
  const params = new URLSearchParams(existing);
  if (!params.has('retryWrites')) params.set('retryWrites', 'true');
  if (!params.has('w')) params.set('w', 'majority');
  const tail = params.toString();
  return tail ? `${base}?${tail}` : base;
}

export function getMongoUri() {
  const raw = process.env.MONGODB_URI;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  return normalizeMongoConnectionString(raw);
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
  return process.env.VERCEL === '1' || process.env.VERCEL === 'true' || !!process.env.VERCEL_URL;
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
 * On Vercel, default driver `family: 4` (unset env). Set MONGODB_DNS_FAMILY=0 to omit; 6 to force IPv6.
 */
export function getMongoDnsFamily() {
  const v = process.env.MONGODB_DNS_FAMILY;
  if (v === undefined || v === null || String(v).trim() === '') {
    if (isVercelServerless()) return 4;
    return undefined;
  }
  const n = Number(String(v).trim());
  if (n === 0) return undefined;
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

/** Prefer IPv4 when resolving mongodb+srv (Node 17+). Complements `family: 4` on Vercel. */
export function preferMongoIpv4DnsOrder() {
  if (!isVercelServerless()) return;
  if (process.env.MONGODB_DNS_V4FIRST === '0') return;
  try {
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first');
    }
  } catch (_) {
    /* ignore */
  }
}
