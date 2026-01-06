// MongoDB Atlas setup script - Initialize collections and indexes
// Access via: POST /api/db/mongodb-setup with admin credentials

import { MongoClient } from 'mongodb';
import { verifyAuth } from './auth';

async function getDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'bismillah_traders');
  
  return { db, client };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
  }

  let client = null;

  try {
    const { db, client: mongoClient } = await getDatabase();
    client = mongoClient;

    // Create collections (MongoDB creates them automatically on first insert)
    // But we'll create them explicitly and add indexes

    // Companies collection
    const companies = db.collection('companies');
    await companies.createIndex({ name: 1 }, { unique: true });
    await companies.createIndex({ created_at: -1 });

    // Products collection
    const products = db.collection('products');
    await products.createIndex({ company_id: 1 });
    await products.createIndex({ sku: 1 }, { unique: true, sparse: true });
    await products.createIndex({ is_active: 1 });
    await products.createIndex({ created_at: -1 });

    // Inventory collection
    const inventory = db.collection('inventory');
    await inventory.createIndex({ product_id: 1 });
    await inventory.createIndex({ created_at: -1 });

    // Stock Levels collection
    const stockLevels = db.collection('stock_levels');
    await stockLevels.createIndex({ product_id: 1 }, { unique: true });
    await stockLevels.createIndex({ updated_at: -1 });

    // Customers collection
    const customers = db.collection('customers');
    await customers.createIndex({ name: 1 });
    await customers.createIndex({ created_at: -1 });

    // Suppliers collection
    const suppliers = db.collection('suppliers');
    await suppliers.createIndex({ name: 1 });
    await suppliers.createIndex({ created_at: -1 });

    // Sales collection
    const sales = db.collection('sales');
    await sales.createIndex({ invoice_number: 1 }, { unique: true, sparse: true });
    await sales.createIndex({ customer_id: 1 });
    await sales.createIndex({ sale_date: -1 });
    await sales.createIndex({ created_at: -1 });

    // Sale Items collection
    const saleItems = db.collection('sale_items');
    await saleItems.createIndex({ sale_id: 1 });
    await saleItems.createIndex({ product_id: 1 });

    // Payments collection
    const payments = db.collection('payments');
    await payments.createIndex({ sale_id: 1 });
    await payments.createIndex({ customer_id: 1 });
    await payments.createIndex({ supplier_id: 1 });
    await payments.createIndex({ payment_date: -1 });

    // Staff collection
    const staff = db.collection('staff');
    await staff.createIndex({ is_active: 1 });
    await staff.createIndex({ created_at: -1 });

    // Attendance collection
    const attendance = db.collection('attendance');
    await attendance.createIndex({ staff_id: 1, date: 1 }, { unique: true });
    await attendance.createIndex({ date: -1 });

    // Expenses collection
    const expenses = db.collection('expenses');
    await expenses.createIndex({ expense_date: -1 });
    await expenses.createIndex({ category: 1 });

    await mongoClient.close();

    return res.status(200).json({
      success: true,
      message: 'MongoDB collections and indexes created successfully',
    });
  } catch (error) {
    console.error('MongoDB setup error:', error);
    if (client) {
      await client.close();
    }
    return res.status(500).json({
      error: 'Database setup failed',
      message: error.message,
    });
  }
}

