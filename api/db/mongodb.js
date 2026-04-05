// Vercel MongoDB Atlas API route — eff1b17-style: default driver options + cached client + URI db path injection.

import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuth } from './auth';
import { getMongoUriAndDbName } from './mongo-env.js';

let cachedClient = null;
let cachedDb = null;
/** One shared in-flight connect so parallel API calls (e.g. dashboard) do not open N TLS handshakes at once. */
let connectPromise = null;

async function getMongoClient() {
  if (cachedClient) {
    return cachedClient;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      const { uri, dbName } = getMongoUriAndDbName();
      const client = new MongoClient(uri);
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

async function getDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  await getMongoClient();
  return cachedDb;
}

/** Sum sale total — supports final_amount (snake) or finalAmount (camel). */
function sumFinalAmount() {
  return {
    $sum: {
      $convert: {
        input: {
          $ifNull: ['$final_amount', { $ifNull: ['$finalAmount', 0] }],
        },
        to: 'double',
        onError: 0,
        onNull: 0,
      },
    },
  };
}

function sumOutstandingBalance() {
  return {
    $sum: {
      $convert: {
        input: {
          $ifNull: [
            '$outstanding_balance',
            { $ifNull: ['$outstandingBalance', 0] },
          ],
        },
        to: 'double',
        onError: 0,
        onNull: 0,
      },
    },
  };
}

/** One HTTP round-trip for dashboard — avoids N sequential serverless invocations. */
async function runDashboardStats(db, data = {}) {
  const today =
    typeof data.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.today)
      ? data.today
      : new Date().toISOString().split('T')[0];

  const dayKeys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const trendStart = dayKeys[0];

  const addDayKey = {
    $addFields: {
      _dayKey: {
        $substrBytes: [{ $toString: { $ifNull: ['$sale_date', ''] } }, 0, 10],
      },
    },
  };

  const sales = db.collection('sales');
  const customers = db.collection('customers');
  const products = db.collection('products');
  const stockLevels = db.collection('stock_levels');

  const [
    totalSalesRows,
    todaySalesRows,
    totalCustomers,
    totalProducts,
    lowStock,
    balanceRows,
    trendAgg,
  ] = await Promise.all([
    sales.aggregate([{ $group: { _id: null, total: sumFinalAmount() } }]).toArray(),
    sales
      .aggregate([
        addDayKey,
        { $match: { _dayKey: today } },
        { $group: { _id: null, total: sumFinalAmount() } },
      ])
      .toArray(),
    customers.countDocuments({}),
    products.countDocuments({ is_active: { $in: [1, true] } }),
    stockLevels.countDocuments({
      $expr: {
        $lte: [
          { $toDouble: { $ifNull: ['$quantity', 0] } },
          { $toDouble: { $ifNull: ['$low_stock_threshold', 10] } },
        ],
      },
    }),
    customers.aggregate([{ $group: { _id: null, total: sumOutstandingBalance() } }]).toArray(),
    sales
      .aggregate([
        addDayKey,
        { $match: { _dayKey: { $gte: trendStart } } },
        { $group: { _id: '$_dayKey', total: sumFinalAmount() } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
  ]);

  const trendMap = Object.fromEntries(
    trendAgg.map((r) => [r._id, Number(r.total) || 0])
  );
  const salesByDay = dayKeys.map((day) => ({
    day,
    total: trendMap[day] || 0,
  }));

  return {
    totalSales: Number(totalSalesRows[0]?.total) || 0,
    todaySales: Number(todaySalesRows[0]?.total) || 0,
    totalCustomers,
    totalProducts,
    lowStock,
    outstandingBalance: Number(balanceRows[0]?.total) || 0,
    salesByDay,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
  }

  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const db = await getDatabase();
    const body = req.body || {};
    const { method, collection, filter = {}, data = {}, options = {} } = body;

    if (method === 'dashboardStats') {
      const stats = await runDashboardStats(db, data);
      return res.status(200).json({ success: true, data: stats });
    }

    if (!method || !collection) {
      return res.status(400).json({ error: 'Method and collection required' });
    }

    const mongoFilter = convertFilterToMongo(filter);

    let result;
    const coll = db.collection(collection);

    switch (method) {
      case 'insertOne': {
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
        break;
      }

      case 'insertMany': {
        const insertResult = await coll.insertMany(Array.isArray(data) ? data : [data]);
        result = {
          lastInsertRowid: insertResult.insertedIds[0]?.toString() || null,
          changes: insertResult.insertedCount,
        };
        break;
      }

      case 'findOne': {
        const doc = await coll.findOne(mongoFilter, options);
        result = doc ? convertMongoDoc(doc) : null;
        break;
      }

      case 'find': {
        const cursor = coll.find(mongoFilter, options);
        const docs = await cursor.toArray();
        result = docs.map(convertMongoDoc);
        break;
      }

      case 'updateOne': {
        const updateData = {
          ...data,
          updated_at: data.updated_at || new Date().toISOString(),
        };

        const debug = process.env.DEBUG_MONGO_API === '1';
        if (debug) {
          console.log('MongoDB: updateOne - filter:', JSON.stringify(mongoFilter, null, 2), 'data:', updateData);
        }

        let updateResult = await coll.updateOne(mongoFilter, { $set: updateData }, options);

        if (updateResult.matchedCount === 0 && mongoFilter._id && mongoFilter.id) {
          if (debug) console.log('MongoDB: No match with both _id and id, trying with just _id');
          const filterWithJustId = { _id: mongoFilter._id };
          updateResult = await coll.updateOne(filterWithJustId, { $set: updateData }, options);
        }

        if (debug) {
          console.log('MongoDB: updateOne result - matched:', updateResult.matchedCount, 'modified:', updateResult.modifiedCount);
        }

        if (updateResult.matchedCount === 0) {
          console.warn('MongoDB: No document matched the filter. Filter was:', JSON.stringify(mongoFilter, null, 2));
        }

        result = {
          changes: updateResult.modifiedCount,
          matchedCount: updateResult.matchedCount,
        };
        break;
      }

      case 'updateMany': {
        const updateResult = await coll.updateMany(mongoFilter, { $set: data }, options);
        result = {
          changes: updateResult.modifiedCount,
          matchedCount: updateResult.matchedCount,
        };
        break;
      }

      case 'deleteOne': {
        const deleteResult = await coll.deleteOne(mongoFilter);
        result = {
          changes: deleteResult.deletedCount,
        };
        break;
      }

      case 'deleteMany': {
        const deleteResult = await coll.deleteMany(mongoFilter);
        result = {
          changes: deleteResult.deletedCount,
        };
        break;
      }

      case 'aggregate': {
        const pipeline = data.pipeline || [];
        const cursor = coll.aggregate(pipeline);
        const docs = await cursor.toArray();
        result = docs.map(convertMongoDoc);
        break;
      }

      case 'count': {
        const count = await coll.countDocuments(mongoFilter);
        result = count;
        break;
      }

      default:
        return res.status(400).json({
          error: 'Invalid method',
          validMethods: [
            'insertOne',
            'insertMany',
            'findOne',
            'find',
            'updateOne',
            'updateMany',
            'deleteOne',
            'deleteMany',
            'aggregate',
            'count',
            'dashboardStats',
          ],
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

function convertFilterToMongo(filter) {
  if (!filter || typeof filter !== 'object') {
    return filter;
  }

  const mongoFilter = { ...filter };

  if (mongoFilter.id !== undefined && !mongoFilter._id) {
    try {
      const idValue = mongoFilter.id;
      if (ObjectId.isValid(idValue)) {
        mongoFilter._id = new ObjectId(idValue);
        delete mongoFilter.id;
        if (process.env.DEBUG_MONGO_API === '1') {
          console.log('MongoDB: Converted id to ObjectId:', idValue, '->', mongoFilter._id.toString());
        }
      } else {
        console.warn('MongoDB: id is not a valid ObjectId format:', idValue);
        mongoFilter._id = idValue;
        delete mongoFilter.id;
      }
    } catch (err) {
      console.warn('MongoDB: Could not convert id to ObjectId:', mongoFilter.id, err);
      mongoFilter._id = mongoFilter.id;
      delete mongoFilter.id;
    }
  }

  if (process.env.DEBUG_MONGO_API === '1') {
    console.log('MongoDB: Final filter after conversion:', JSON.stringify(mongoFilter, null, 2));
  }
  return mongoFilter;
}

function convertMongoDoc(doc) {
  if (!doc) return null;

  const converted = { ...doc };
  if (converted._id) {
    converted.id = converted._id.toString();
    delete converted._id;
  }

  Object.keys(converted).forEach((key) => {
    if (converted[key] instanceof Date) {
      converted[key] = converted[key].toISOString();
    } else if (
      converted[key] &&
      typeof converted[key] === 'object' &&
      converted[key].constructor?.name === 'Date'
    ) {
      converted[key] = new Date(converted[key]).toISOString();
    }
  });

  return converted;
}
