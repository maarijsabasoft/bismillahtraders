/**
 * Shared MongoClient options for Atlas from Vercel serverless.
 * Centralized so api/db/mongodb.js and mongodb-setup.js stay aligned.
 */

import { ServerApiVersion } from 'mongodb';
import { getMongoDriverTimeouts, getMongoDnsFamily, isVercelRuntime } from './mongo-env.js';

export function buildAtlasMongoClientOptions() {
  const { serverSelectionTimeoutMS, connectTimeoutMS, socketTimeoutMS } = getMongoDriverTimeouts();
  const family = getMongoDnsFamily();
  const onVercel = isVercelRuntime();
  // Stable API can change handshake behavior; off on Vercel unless MONGODB_USE_SERVER_API=1.
  const useServerApi =
    !onVercel
      ? process.env.MONGODB_DISABLE_SERVER_API !== '1'
      : process.env.MONGODB_USE_SERVER_API === '1' && process.env.MONGODB_DISABLE_SERVER_API !== '1';

  const pool = Number(process.env.MONGODB_MAX_POOL_SIZE);
  const maxPoolSize = Number.isFinite(pool) && pool > 0 ? Math.min(pool, 50) : 5;

  let insecureTls = {};
  if (process.env.MONGODB_TLS_ALLOW_INVALID === '1') {
    console.error('WARNING: MONGODB_TLS_ALLOW_INVALID=1 — TLS cert verification disabled. Debugging only.');
    insecureTls = { tlsAllowInvalidCertificates: true };
  }

  return {
    maxPoolSize,
    minPoolSize: 0,
    maxIdleTimeMS: onVercel ? 8000 : 20000,
    serverSelectionTimeoutMS,
    connectTimeoutMS,
    socketTimeoutMS,
    retryWrites: true,
    compressors: [],
    ...(useServerApi
      ? {
          serverApi: {
            version: ServerApiVersion.v1,
            strict: false,
            deprecationErrors: false,
          },
        }
      : {}),
    ...(family !== undefined ? { family } : {}),
    ...insecureTls,
  };
}
