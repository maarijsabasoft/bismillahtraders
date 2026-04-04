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
