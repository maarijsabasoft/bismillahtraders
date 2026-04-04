/**
 * Minimal MongoDB Atlas + Node.js example (wholesale beverage-style demo data).
 *
 * Why this file exists: proves your URI, driver, and Atlas network rules work before
 * wiring a full app. Each step logs to the console so you can follow the flow.
 *
 * Install (once, from this project folder):
 *   npm install mongodb
 *
 * Run (PowerShell — replace the placeholder with your Atlas SRV string from the UI):
 *   $env:MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster.../"; node mongodbExample.js
 *
 * Optional fallback if you prefer not to use shell env vars: create a file named
 * mongodbExample.local.json in the same folder as this script:
 *   { "MONGODB_URI": "your-uri-here" }
 * Do not commit that JSON file; it is only for local practice.
 */

const fs = require('fs');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB_NAME?.trim() || 'bismillah_traders';
/** Isolated collection name so this demo does not collide with your real collections. */
const COLLECTION = 'mongodb_example_demo';

function loadMongoUri() {
  const fromEnv = process.env.MONGODB_URI;
  if (fromEnv && String(fromEnv).trim()) {
    console.log('Using MONGODB_URI from environment variables.');
    return String(fromEnv).trim();
  }

  const configPath = path.join(__dirname, 'mongodbExample.local.json');
  if (fs.existsSync(configPath)) {
    console.log('Using MONGODB_URI from mongodbExample.local.json (same folder as this script).');
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const uri = parsed.MONGODB_URI || parsed.mongodbUri;
    if (uri && String(uri).trim()) return String(uri).trim();
  }

  throw new Error(
    'No MongoDB URI found. Set MONGODB_URI in the shell or add mongodbExample.local.json. See comments at the top of this file.'
  );
}

async function run() {
  let client;

  try {
    const uri = loadMongoUri();

    // Stable API matches Atlas “Connect” sample: predictable behavior across driver upgrades.
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    console.log('\n→ Connecting to Atlas…');
    await client.connect();

    // Ping proves TLS + auth + network path; admin db is standard for this check.
    await client.db('admin').command({ ping: 1 });
    console.log('✓ Ping succeeded — driver reached your cluster.\n');

    const db = client.db(DB_NAME);
    const coll = db.collection(COLLECTION);

    const productNames = [
      'Cola PET 1.5L',
      'Orange syrup 2L',
      'Mineral water 500ml',
      'Energy can 250ml',
      'Apple juice tetra 1L',
      'Mango drink 200ml',
      'Lassi bottle 300ml',
      'Sparkling water 330ml',
      'Green tea PET 500ml',
      'Lemon soda 1.25L',
    ];

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Spread recorded_at across ~9 days plus hourly offsets so “most recent 5” is meaningful.
    const docsToInsert = productNames.map((product_name, i) => ({
      sku: `DEMO-BT-${200 + i}`,
      product_name,
      cases_on_hand: 12 + i * 4,
      unit: 'case',
      supplier_region: i % 2 === 0 ? 'Karachi' : 'Lahore',
      demo_note: 'Seed data from mongodbExample.js — safe to delete this collection later.',
      recorded_at: new Date(now - (9 - i) * oneDayMs - i * 3_600_000),
    }));

    console.log(`→ Inserting ${docsToInsert.length} documents into "${DB_NAME}.${COLLECTION}"…`);
    const insertResult = await coll.insertMany(docsToInsert);
    console.log('✓ Inserted. insertedCount:', insertResult.insertedCount);

    const allNewIds = Object.values(insertResult.insertedIds);
    const pickId = allNewIds[3];
    console.log('  (We will fetch by _id later:', pickId.toString(), ')\n');

    console.log('→ Reading the 5 most recent documents (full BSON → plain objects) by recorded_at…');
    const recentFive = await coll
      .find({})
      .sort({ recorded_at: -1 })
      .limit(5)
      .toArray();
    console.log(JSON.stringify(recentFive, null, 2));

    console.log('\n→ Reading one full document by _id…');
    const byId = await coll.findOne({ _id: pickId });
    if (!byId) {
      throw new Error('findOne by _id returned nothing — unexpected after insert.');
    }
    console.log(JSON.stringify(byId, null, 2));

    console.log('\nDone. Connection will close in finally {}.');
  } catch (err) {
    console.error('\n✗ Example failed:', err.message || err);
    if (err?.code) console.error('  code:', err.code);
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close();
      console.log('✓ MongoClient closed.\n');
    }
  }
}

run();
