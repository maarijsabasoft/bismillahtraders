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

  return {
    // Single connection per warm lambda reduces stale-socket races; pool still OK across Atlas.
    maxPoolSize: onVercel ? 1 : 5,
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
