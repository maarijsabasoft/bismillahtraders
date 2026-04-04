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
