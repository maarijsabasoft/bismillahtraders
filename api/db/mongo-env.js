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

/**
 * Same URI shaping as commit eff1b17: if the SRV/URI has no DB path, inject /dbName before query string.
 * Then use plain `new MongoClient(uri)` with driver defaults (no extra TLS/DNS options).
 */
export function getMongoUriAndDbName() {
  let uri = getMongoUri();
  let dbName = getResolvedMongoDbName(uri);

  const dbNameMatch = uri.match(/mongodb(\+srv)?:\/\/[^/]+\/([^/?]+)/);
  if (dbNameMatch && dbNameMatch[2]) {
    dbName = dbNameMatch[2];
  } else {
    if (uri.includes('?')) {
      uri = uri.replace('?', `/${dbName}?`);
    } else {
      uri = `${uri}/${dbName}`;
    }
  }

  return { uri, dbName };
}
