// Vercel MongoDB Atlas API route - Fast, reliable, no timeouts
// Uses MongoDB Atlas for serverless document database

import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import { verifyAuth } from './auth';
import {
  getMongoUri,
  getResolvedMongoDbName,
  getMongoDriverTimeouts,
  getMongoDnsFamily,
  isVercelRuntime,
} from './mongo-env.js';

// MongoDB connection — single in-flight connect so parallel API calls (dashboard load) don't stack connects
let cachedClient = null;
let cachedDb = null;
let connectPromise = null;

/** Retry only quick transient handshake/pool errors — not server-selection timeouts (would double wait vs Vercel limit). */
function isMongoHandshakeRetryError(err) {
  const m = err && err.message ? err.message : String(err);
  if (m.includes('Server selection timed out')) return false;
  if (m.includes('wait queue timed out')) return false;
  if (m.includes('ETIMEDOUT') && !m.includes('SSL') && !m.includes('TLS')) return false;
  return (
    m.includes('SSL') ||
    m.includes('TLS') ||
    m.includes('tlsv1 alert') ||
    m.includes('alert number 80') ||
    m.includes('ECONNRESET') ||
    m.includes('ENOTFOUND') ||
    m.includes('PoolCleared') ||
    m.includes('MongoNetworkError') ||
    (m.includes('network error') && !m.includes('timed out'))
  );
}

async function resetMongoConnection() {
  connectPromise = null;
  const client = cachedClient;
  cachedClient = null;
  cachedDb = null;
  if (client) {
    try {
      await client.close();
    } catch (e) {
      console.warn('MongoDB: close during reset:', e.message);
    }
  }
}

async function getMongoClient() {
  if (cachedClient) {
    return cachedClient;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      const uri = getMongoUri();
      const dbName = getResolvedMongoDbName(uri);
      const { serverSelectionTimeoutMS, connectTimeoutMS, socketTimeoutMS } = getMongoDriverTimeouts();
      const family = getMongoDnsFamily();
      const onVercel = isVercelRuntime();
      const client = new MongoClient(uri, {
        maxPoolSize: 5,
        minPoolSize: 0,
        // Recycle idle sockets sooner on serverless — thawed lambdas often see dead TLS on old pool members
        maxIdleTimeMS: onVercel ? 10000 : 20000,
        serverSelectionTimeoutMS,
        connectTimeoutMS,
        socketTimeoutMS,
        retryWrites: true,
        serverApi: {
          version: ServerApiVersion.v1,
          strict: false,
          deprecationErrors: false,
        },
        ...(family !== undefined ? { family } : {}),
      });
      await client.connect();
      cachedClient = client;
      cachedDb = client.db(dbName);
    })();
  }

  try {
    await connectPromise;
    return cachedClient;
  } catch (err) {
    connectPromise = null;
    cachedClient = null;
    cachedDb = null;
    throw err;
  }
}

/** After Vercel freezes a function, a cached TCP/TLS session may be invalid — ping before work to force reconnect. */
async function invalidateClientIfPingFails() {
  if (!cachedClient) return;
  const budgetMs = isVercelRuntime() ? 2500 : 5000;
  try {
    await Promise.race([
      cachedClient.db('admin').command({ ping: 1 }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('MongoDB ping timeout')), budgetMs);
      }),
    ]);
  } catch (e) {
    console.warn('MongoDB: ping failed, resetting client:', e && e.message ? e.message : e);
    await resetMongoConnection();
  }
}

async function getDatabase() {
  await invalidateClientIfPingFails();
  if (cachedDb) {
    return cachedDb;
  }

  await getMongoClient();
  return cachedDb;
}

// Convert SQL WHERE clause to MongoDB filter (simplified)
function sqlToMongoFilter(sql, params) {
  // This is a simplified converter - for complex queries, use MongoDB native syntax
  // For now, we'll handle basic WHERE clauses
  const filter = {};
  
  // Simple parameter substitution for WHERE column = ?
  if (params && params.length > 0) {
    // Extract column names from SQL (simplified)
    const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
    if (whereMatch) {
      filter[whereMatch[1]] = params[0];
    }
  }
  
  return filter;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify authentication
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
  }

  // Never serve stale DB reads from browser or CDN after deploy/restart
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const db = await getDatabase();
        const { method, collection, operation, filter = {}, data = {}, options = {} } = req.body;

        if (!method || !collection) {
          return res.status(400).json({ error: 'Method and collection required' });
        }

        // Convert 'id' field in filter to '_id' ObjectId for MongoDB
        const mongoFilter = convertFilterToMongo(filter);

        let result;
        const coll = db.collection(collection);

        switch (method) {
      case 'insertOne':
        {
          const now = new Date().toISOString();
          const insertData = {
            ...data,
            created_at: data.created_at || now,
            updated_at: data.updated_at || now,
          };
          const payloadKeys = Object.keys(data || {}).filter(
            (k) => k !== 'created_at' && k !== 'updated_at'
          );
          if (payloadKeys.length === 0) {
            return res.status(400).json({
              error: 'Empty insert',
              message: 'Client sent insertOne with no business fields. Check Mongo SQL-to-JSON parsing.',
            });
          }

          const insertResult = await coll.insertOne(insertData);
          result = {
            lastInsertRowid: insertResult.insertedId.toString(),
            changes: 1,
          };
        }
        break;

      case 'insertMany':
        {
          const insertResult = await coll.insertMany(Array.isArray(data) ? data : [data]);
          result = {
            lastInsertRowid: insertResult.insertedIds[0]?.toString() || null,
            changes: insertResult.insertedCount,
          };
        }
        break;

      case 'findOne':
        {
          const doc = await coll.findOne(mongoFilter, options);
          result = doc ? convertMongoDoc(doc) : null;
        }
        break;

      case 'find':
        {
          const cursor = coll.find(mongoFilter, options);
          const docs = await cursor.toArray();
          result = docs.map(convertMongoDoc);
        }
        break;

      case 'updateOne':
        {
          // Add updated_at if not present
          const updateData = {
            ...data,
            updated_at: data.updated_at || new Date().toISOString(),
          };
          
          console.log('MongoDB: updateOne - filter:', JSON.stringify(mongoFilter, null, 2), 'data:', updateData);
          
          // Try update with _id first
          let updateResult = await coll.updateOne(mongoFilter, { $set: updateData }, options);
          
          // If no match and filter has both _id and id, try with just _id
          if (updateResult.matchedCount === 0 && mongoFilter._id && mongoFilter.id) {
            console.log('MongoDB: No match with both _id and id, trying with just _id');
            const filterWithJustId = { _id: mongoFilter._id };
            updateResult = await coll.updateOne(filterWithJustId, { $set: updateData }, options);
          }
          
          console.log('MongoDB: updateOne result - matched:', updateResult.matchedCount, 'modified:', updateResult.modifiedCount);
          
          if (updateResult.matchedCount === 0) {
            console.warn('MongoDB: No document matched the filter. Filter was:', JSON.stringify(mongoFilter, null, 2));
          }
          
          result = {
            changes: updateResult.modifiedCount,
            matchedCount: updateResult.matchedCount,
          };
        }
        break;

      case 'updateMany':
        {
          const updateResult = await coll.updateMany(mongoFilter, { $set: data }, options);
          result = {
            changes: updateResult.modifiedCount,
            matchedCount: updateResult.matchedCount,
          };
        }
        break;

      case 'deleteOne':
        {
          const deleteResult = await coll.deleteOne(mongoFilter);
          result = {
            changes: deleteResult.deletedCount,
          };
        }
        break;

      case 'deleteMany':
        {
          const deleteResult = await coll.deleteMany(mongoFilter);
          result = {
            changes: deleteResult.deletedCount,
          };
        }
        break;

      case 'aggregate':
        {
          const pipeline = data.pipeline || [];
          const cursor = coll.aggregate(pipeline);
          const docs = await cursor.toArray();
          result = docs.map(convertMongoDoc);
        }
        break;

      case 'count':
        {
          const count = await coll.countDocuments(mongoFilter);
          result = count;
        }
        break;

      default:
        return res.status(400).json({ 
          error: 'Invalid method', 
          validMethods: ['insertOne', 'insertMany', 'findOne', 'find', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'aggregate', 'count']
        });
    }

        return res.status(200).json({ success: true, data: result });
      } catch (error) {
        if (attempt === 0 && isMongoHandshakeRetryError(error)) {
          console.warn('MongoDB: transient error, resetting connection and retrying once:', error.message);
          await resetMongoConnection();
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('MongoDB error:', error);
    return res.status(500).json({
      error: 'Database operation failed',
      message: error.message,
    });
  }
}

// Convert filter with 'id' field to MongoDB '_id' ObjectId (other keys like product_id pass through as-is)
function convertFilterToMongo(filter) {
  if (!filter || typeof filter !== 'object') {
    return filter;
  }
  
  const mongoFilter = { ...filter };
  
  if (mongoFilter.id !== undefined && !mongoFilter._id) {
    try {
      const idValue = mongoFilter.id;
      // Try to convert string id to ObjectId
      if (ObjectId.isValid(idValue)) {
        mongoFilter._id = new ObjectId(idValue);
        delete mongoFilter.id;
        console.log('MongoDB: Converted id to ObjectId:', idValue, '->', mongoFilter._id.toString());
      } else {
        // If not a valid ObjectId, keep id as string for fallback search
        console.warn('MongoDB: id is not a valid ObjectId format:', idValue);
        // Keep both id and _id for fallback
        mongoFilter._id = idValue;
      }
    } catch (error) {
      // If conversion fails, use as string
      console.warn('MongoDB: Could not convert id to ObjectId:', mongoFilter.id, error);
      mongoFilter._id = mongoFilter.id;
      delete mongoFilter.id;
    }
  }
  
  console.log('MongoDB: Final filter after conversion:', JSON.stringify(mongoFilter, null, 2));
  return mongoFilter;
}

// Convert MongoDB document to plain object
function convertMongoDoc(doc) {
  if (!doc) return null;
  
  const converted = { ...doc };
  // Convert ObjectId to string
  if (converted._id) {
    converted.id = converted._id.toString();
    delete converted._id;
  }
  
  // Convert Date objects to ISO strings for compatibility
  Object.keys(converted).forEach(key => {
    if (converted[key] instanceof Date) {
      converted[key] = converted[key].toISOString();
    } else if (converted[key] && typeof converted[key] === 'object' && converted[key].constructor?.name === 'Date') {
      // Handle MongoDB Date objects
      converted[key] = new Date(converted[key]).toISOString();
    }
  });
  
  return converted;
}

