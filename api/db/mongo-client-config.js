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
  const disableServerApi = process.env.MONGODB_DISABLE_SERVER_API === '1';

  const pool = Number(process.env.MONGODB_MAX_POOL_SIZE);
  const maxPoolSize = Number.isFinite(pool) && pool > 0 ? Math.min(pool, 50) : 5;

  return {
    // Small pool + ping-before-use avoids stale TLS; override with MONGODB_MAX_POOL_SIZE if needed.
    maxPoolSize,
    minPoolSize: 0,
    maxIdleTimeMS: onVercel ? 8000 : 20000,
    serverSelectionTimeoutMS,
    connectTimeoutMS,
    socketTimeoutMS,
    retryWrites: true,
    // Some TLS middleboxes / serverless paths break with wire compression + TLS.
    compressors: [],
    ...(!disableServerApi
      ? {
          serverApi: {
            version: ServerApiVersion.v1,
            strict: false,
            deprecationErrors: false,
          },
        }
      : {}),
    ...(family !== undefined ? { family } : {}),
  };
}
