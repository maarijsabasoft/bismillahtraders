// Vercel MongoDB Atlas API route - Fast, reliable, no timeouts
// Uses MongoDB Atlas for serverless document database

import { MongoClient, ObjectId } from 'mongodb';
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

    // Convert 'id' field in filter to '_id' ObjectId for MongoDB
    const mongoFilter = convertFilterToMongo(filter);

    let result;
    const coll = db.collection(collection);

    switch (method) {
      case 'insertOne':
        {
          // Add created_at and updated_at if not present
          const now = new Date().toISOString();
          const insertData = {
            ...data,
            created_at: data.created_at || now,
            updated_at: data.updated_at || now,
          };
          
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
          
          const updateResult = await coll.updateOne(mongoFilter, { $set: updateData }, options);
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
    console.error('MongoDB error:', error);
    return res.status(500).json({
      error: 'Database operation failed',
      message: error.message,
    });
  }
}

// Convert filter with 'id' field to MongoDB '_id' ObjectId
function convertFilterToMongo(filter) {
  if (!filter || typeof filter !== 'object') {
    return filter;
  }
  
  const mongoFilter = { ...filter };
  
  // If filter has 'id' field, convert it to '_id' ObjectId
  if (mongoFilter.id !== undefined) {
    try {
      // Try to convert string id to ObjectId
      mongoFilter._id = ObjectId.isValid(mongoFilter.id) 
        ? new ObjectId(mongoFilter.id) 
        : mongoFilter.id;
      delete mongoFilter.id;
    } catch (error) {
      // If conversion fails, keep original id
      console.warn('Could not convert id to ObjectId:', mongoFilter.id);
    }
  }
  
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

