// Vercel Serverless Function for database queries
// This handles all database operations and stores SQLite file in Vercel Blob Storage

import { put, get, head } from '@vercel/blob';
import initSqlJs from 'sql.js';
import https from 'https';

const DB_BLOB_KEY = 'bismillah_traders.db';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Helper to download WASM file for sql.js with timeout
async function downloadWasm() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WASM download timeout'));
    }, 10000); // 10 second timeout

    https.get('https://sql.js.org/dist/sql-wasm.wasm', (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks));
      });
      response.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });
}

// Verify admin authentication
function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }
  
  const credentials = Buffer.from(authHeader.substring(6), 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');
  
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

// Load database from blob storage with timeout
async function loadDatabase() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error('BLOB_READ_WRITE_TOKEN not configured');
    }
    
    // Add timeout to blob get operation
    const blobPromise = get(DB_BLOB_KEY, {
      token: token,
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Blob load timeout')), 15000)
    );
    
    const blob = await Promise.race([blobPromise, timeoutPromise]);
    
    if (blob) {
      // Add timeout to fetch operation
      const fetchPromise = fetch(blob.url);
      const fetchTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database fetch timeout')), 15000)
      );
      
      const response = await Promise.race([fetchPromise, fetchTimeoutPromise]);
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }
  } catch (error) {
    // Database doesn't exist yet, will create new one
    if (error.message.includes('not found') || error.statusCode === 404 || error.message.includes('timeout')) {
      console.log('Database not found or timeout, will create new');
    } else {
      console.error('Error loading database:', error.message);
    }
  }
  return null;
}

// Save database to blob storage with timeout
async function saveDatabase(db) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error('BLOB_READ_WRITE_TOKEN not configured');
    }
    
    const data = db.export();
    const buffer = Buffer.from(data);
    
    // Add timeout to blob put operation
    const putPromise = put(DB_BLOB_KEY, buffer, {
      access: 'public',
      contentType: 'application/octet-stream',
      token: token,
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Blob save timeout')), 20000)
    );
    
    await Promise.race([putPromise, timeoutPromise]);
    
    console.log('Database saved to blob storage');
    return true;
  } catch (error) {
    console.error('Error saving database:', error);
    throw error;
  }
}

// Initialize database tables
function createTables(db) {
  // Companies
  db.run(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sku TEXT UNIQUE,
      barcode TEXT,
      category TEXT,
      bottle_size TEXT,
      purchase_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      discount_rate REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    )
  `);

  // Inventory
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      batch_number TEXT,
      expiry_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Stock Levels
  db.run(`
    CREATE TABLE IF NOT EXISTS stock_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER DEFAULT 10,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Customers
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      business_type TEXT,
      credit_limit REAL DEFAULT 0,
      outstanding_balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Suppliers
  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      contact_person TEXT,
      payable_balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sales
  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE,
      customer_id INTEGER,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_amount REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      final_amount REAL NOT NULL,
      payment_method TEXT,
      payment_status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    )
  `);

  // Sale Items
  db.run(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Payments
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      customer_id INTEGER,
      supplier_id INTEGER,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    )
  `);

  // Staff
  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      role TEXT NOT NULL,
      salary REAL DEFAULT 0,
      hire_date DATE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Attendance
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      date DATE NOT NULL,
      check_in TIME,
      check_out TIME,
      status TEXT DEFAULT 'present',
      notes TEXT,
      UNIQUE(staff_id, date),
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    )
  `);

  // Expenses
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      expense_date DATE DEFAULT CURRENT_DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
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

  // Set a maximum execution time (Vercel has 10s for Hobby, 60s for Pro)
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 50000; // 50 seconds to leave buffer

  try {
    // Initialize sql.js with timeout
    const wasmBuffer = await downloadWasm();
    const SQL = await initSqlJs({
      locateFile: () => wasmBuffer,
    });

    // Check timeout
    if (Date.now() - startTime > MAX_EXECUTION_TIME) {
      throw new Error('Operation timeout: Initialization took too long');
    }

    // Load or create database
    let dbData = await loadDatabase();
    const db = dbData 
      ? new SQL.Database(dbData)
      : new SQL.Database();

    // Create tables if new database
    if (!dbData) {
      createTables(db);
    }

    const { method, sql, params = [] } = req.body;

    if (!method || !sql) {
      db.close();
      return res.status(400).json({ error: 'Method and SQL query required' });
    }

    let result;
    let needsSave = false;

    switch (method) {
      case 'run':
        {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          stmt.step();
          stmt.free();

          // Get last insert rowid
          const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
          const lastInsertRowid = lastIdResult.length > 0 && lastIdResult[0].values.length > 0
            ? lastIdResult[0].values[0][0]
            : null;

          result = { lastInsertRowid, changes: 1 };
          needsSave = true;
        }
        break;

      case 'get':
        {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          const hasRow = stmt.step();
          let row = null;
          if (hasRow) {
            const rowObj = stmt.getAsObject();
            // Convert to plain object with proper types
            row = {};
            for (const key in rowObj) {
              const value = rowObj[key];
              if (typeof value === 'string' && !isNaN(value) && value !== '') {
                row[key] = parseFloat(value);
              } else {
                row[key] = value;
              }
            }
          }
          stmt.free();
          result = row;
        }
        break;

      case 'all':
        {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            stmt.bind(params);
          }
          const rows = [];
          while (stmt.step()) {
            const rowObj = stmt.getAsObject();
            const row = {};
            for (const key in rowObj) {
              const value = rowObj[key];
              if (typeof value === 'string' && !isNaN(value) && value !== '') {
                row[key] = parseFloat(value);
              } else {
                row[key] = value;
              }
            }
            rows.push(row);
          }
          stmt.free();
          result = rows;
        }
        break;

      default:
        db.close();
        return res.status(400).json({ error: 'Invalid method. Use run, get, or all' });
    }

    // Only save on write operations to improve performance
    if (needsSave) {
      // Check timeout before saving
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        db.close();
        throw new Error('Operation timeout: Save operation would exceed time limit');
      }
      await saveDatabase(db);
    }

    db.close();

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Database error:', error);
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Database operation failed';
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      errorMessage = 'Database operation timed out. The database may be too large or the connection is slow. Consider using a dedicated database service.';
    }
    
    return res.status(500).json({ 
      error: 'Database operation failed', 
      message: errorMessage 
    });
  }
}

