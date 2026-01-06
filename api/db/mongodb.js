// Vercel MongoDB Atlas API route - Fast, reliable, no timeouts
// Uses MongoDB Atlas for serverless document database

import { MongoClient } from 'mongodb';
import { verifyAuth } from './auth';

// MongoDB connection
let cachedClient = null;
let cachedDb = null;

async function getMongoClient() {
  if (cachedClient) {
    return cachedClient;
  }

  let uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  // Extract database name from URI if present, otherwise use env variable
  let dbName = process.env.MONGODB_DB_NAME || 'bismillah_traders';
  
  // Check if database name is already in URI
  const dbNameMatch = uri.match(/mongodb\+srv:\/\/[^/]+\/([^?]+)/);
  if (dbNameMatch) {
    dbName = dbNameMatch[1];
  } else {
    // Add database name to URI if not present
    if (uri.includes('?')) {
      uri = uri.replace('?', `/${dbName}?`);
    } else {
      uri = uri + `/${dbName}`;
    }
  }

  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  cachedDb = client.db(dbName);
  
  return client;
}

async function getDatabase() {
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

  try {
    const db = await getDatabase();
    const { method, collection, operation, filter = {}, data = {}, options = {} } = req.body;

    if (!method || !collection) {
      return res.status(400).json({ error: 'Method and collection required' });
    }

    let result;
    const coll = db.collection(collection);

    switch (method) {
      case 'insertOne':
        {
          const insertResult = await coll.insertOne(data);
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
          const doc = await coll.findOne(filter, options);
          result = doc ? convertMongoDoc(doc) : null;
        }
        break;

      case 'find':
        {
          const cursor = coll.find(filter, options);
          const docs = await cursor.toArray();
          result = docs.map(convertMongoDoc);
        }
        break;

      case 'updateOne':
        {
          const updateResult = await coll.updateOne(filter, { $set: data }, options);
          result = {
            changes: updateResult.modifiedCount,
            matchedCount: updateResult.matchedCount,
          };
        }
        break;

      case 'updateMany':
        {
          const updateResult = await coll.updateMany(filter, { $set: data }, options);
          result = {
            changes: updateResult.modifiedCount,
            matchedCount: updateResult.matchedCount,
          };
        }
        break;

      case 'deleteOne':
        {
          const deleteResult = await coll.deleteOne(filter);
          result = {
            changes: deleteResult.deletedCount,
          };
        }
        break;

      case 'deleteMany':
        {
          const deleteResult = await coll.deleteMany(filter);
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
          const count = await coll.countDocuments(filter);
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
    console.error('MongoDB error:', error);
    return res.status(500).json({
      error: 'Database operation failed',
      message: error.message,
    });
  }
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
  
  return converted;
}

