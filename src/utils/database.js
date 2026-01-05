import initSqlJs from 'sql.js';

let db = null;
let SQL = null;
const DB_STORAGE_KEY = 'bismillah_traders_db';

// IndexedDB helper functions for browser storage
const openIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BismillahTradersDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('database')) {
        db.createObjectStore('database');
      }
    };
  });
};

const loadFromIndexedDB = async () => {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = idb.transaction(['database'], 'readonly');
      const store = transaction.objectStore('database');
      const request = store.get(DB_STORAGE_KEY);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.log('IndexedDB not available or error loading:', error);
    return null;
  }
};

const saveToIndexedDB = async (data) => {
  try {
    const idb = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = idb.transaction(['database'], 'readwrite');
      const store = transaction.objectStore('database');
      const request = store.put(data, DB_STORAGE_KEY);
      
      request.onsuccess = () => {
        console.log('Database saved to IndexedDB');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
  }
};

export const initDatabase = async () => {
  try {
    // Load sql.js - use CDN for WASM file
    SQL = await initSqlJs({
      locateFile: (file) => {
        // Use CDN for WASM file in browser/Electron
        if (file.endsWith('.wasm')) {
          return `https://sql.js.org/dist/${file}`;
        }
        return file;
      }
    });

    // Try to load existing database
    let dbData = null;
    
    // Try Electron file system first
    if (typeof window !== 'undefined' && window.require) {
      try {
        const fs = window.require('fs');
        const path = window.require('path');
        const electron = window.require('electron');
        
        // Try to get app object (works with nodeIntegration: true)
        let app = null;
        if (electron.remote && electron.remote.app) {
          // Legacy remote module (deprecated but still works)
          app = electron.remote.app;
        } else if (electron.app) {
          // Direct access (when contextIsolation: false)
          app = electron.app;
        }
        
        const userDataPath = app ? app.getPath('userData') : './data';
        const dbPath = path.join(userDataPath, 'bismillah_traders.db');
        
        if (fs.existsSync(dbPath)) {
          dbData = fs.readFileSync(dbPath);
          console.log('Database loaded from Electron file system:', dbPath);
        }
      } catch (error) {
        console.log('Electron file system not available, trying IndexedDB:', error.message);
      }
    }
    
    // If not in Electron, try IndexedDB (browser mode)
    if (!dbData && typeof window !== 'undefined' && window.indexedDB) {
      try {
        const storedData = await loadFromIndexedDB();
        if (storedData) {
          dbData = new Uint8Array(storedData);
          console.log('Database loaded from IndexedDB');
        }
      } catch (error) {
        console.log('Error loading from IndexedDB:', error);
      }
    }

    // Create or load database
    if (dbData) {
      db = new SQL.Database(dbData);
      console.log('Existing database loaded');
    } else {
      db = new SQL.Database();
      createTables();
      console.log('New database created');
    }

    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    // Fallback: create in-memory database
    try {
      SQL = await initSqlJs();
      db = new SQL.Database();
      createTables();
      return true;
    } catch (fallbackError) {
      console.error('Fallback database initialization failed:', fallbackError);
      return false;
    }
  }
};

const createTables = () => {
  if (!db) return;

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

  saveDatabase();
};

// Save database to file or IndexedDB
export const saveDatabase = async () => {
  if (!db || !SQL) return;
  
  try {
    const data = db.export();
    
    // Try Electron file system first
    if (typeof window !== 'undefined' && window.require) {
      try {
        const fs = window.require('fs');
        const path = window.require('path');
        const electron = window.require('electron');
        
        // Try to get app object (works with nodeIntegration: true)
        let app = null;
        if (electron.remote && electron.remote.app) {
          // Legacy remote module (deprecated but still works)
          app = electron.remote.app;
        } else if (electron.app) {
          // Direct access (when contextIsolation: false)
          app = electron.app;
        }
        
        const userDataPath = app ? app.getPath('userData') : './data';
        
        // Ensure directory exists
        if (!fs.existsSync(userDataPath)) {
          fs.mkdirSync(userDataPath, { recursive: true });
        }
        
        const dbPath = path.join(userDataPath, 'bismillah_traders.db');
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
        console.log('Database saved to Electron file system:', dbPath);
        return;
      } catch (error) {
        console.error('Error saving to Electron file system:', error);
        console.log('Falling back to IndexedDB');
      }
    }
    
    // Fallback to IndexedDB for browser mode
    if (typeof window !== 'undefined' && window.indexedDB) {
      await saveToIndexedDB(data);
    }
  } catch (error) {
    console.error('Error saving database:', error);
  }
};

// Database wrapper with better-sqlite3-like API
class DatabaseWrapper {
  prepare(sql) {
    return {
      run: (...params) => {
        if (!db) {
          return Promise.resolve({ lastInsertRowid: 1, changes: 0 });
        }
        try {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            // sql.js bind takes array or object
            if (Array.isArray(params[0])) {
              stmt.bind(params[0]);
            } else {
              stmt.bind(params);
            }
          }
          stmt.step();
          stmt.free();
          
          // Get last insert rowid
          const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
          const lastInsertRowid = lastIdResult.length > 0 && lastIdResult[0].values.length > 0 
            ? lastIdResult[0].values[0][0] 
            : 1;
          
          // Save database asynchronously (fire and forget)
          saveDatabase().catch(err => console.error('Error saving database:', err));
          return Promise.resolve({ lastInsertRowid, changes: 1 });
        } catch (error) {
          console.error('Database run error:', error, sql, params);
          throw error;
        }
      },
      get: (...params) => {
        if (!db) {
          return Promise.resolve(null);
        }
        try {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            if (Array.isArray(params[0])) {
              stmt.bind(params[0]);
            } else {
              stmt.bind(params);
            }
          }
          const hasRow = stmt.step();
          let result = null;
          if (hasRow) {
            result = stmt.getAsObject();
            // Convert to plain object with proper types
            const obj = {};
            for (const key in result) {
              const value = result[key];
              // Convert numeric strings to numbers
              if (typeof value === 'string' && !isNaN(value) && value !== '') {
                obj[key] = parseFloat(value);
              } else {
                obj[key] = value;
              }
            }
            result = Object.keys(obj).length > 0 ? obj : null;
          }
          stmt.free();
          return Promise.resolve(result);
        } catch (error) {
          console.error('Database get error:', error, sql, params);
          return Promise.resolve(null);
        }
      },
      all: (...params) => {
        if (!db) {
          return Promise.resolve([]);
        }
        try {
          const stmt = db.prepare(sql);
          if (params.length > 0) {
            if (Array.isArray(params[0])) {
              stmt.bind(params[0]);
            } else {
              stmt.bind(params);
            }
          }
          const results = [];
          while (stmt.step()) {
            const row = stmt.getAsObject();
            // Convert to plain object with proper types
            const obj = {};
            for (const key in row) {
              const value = row[key];
              // Convert numeric strings to numbers
              if (typeof value === 'string' && !isNaN(value) && value !== '') {
                obj[key] = parseFloat(value);
              } else {
                obj[key] = value;
              }
            }
            results.push(obj);
          }
          stmt.free();
          return Promise.resolve(results);
        } catch (error) {
          console.error('Database all error:', error, sql, params);
          return Promise.resolve([]);
        }
      }
    };
  }
}

const dbWrapper = new DatabaseWrapper();

export const getDatabase = () => {
  return dbWrapper;
};
