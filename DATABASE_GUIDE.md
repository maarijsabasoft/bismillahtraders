# Database Execution Guide

This guide explains how to execute database operations in the Bismillah Traders application.

## Overview

The application uses **sql.js** (SQLite compiled to WebAssembly) for client-side database operations. The database is automatically initialized when the app starts.

## 1. Accessing the Database

### In React Components

```javascript
import { useDatabase } from '../../context/DatabaseContext';

const MyComponent = () => {
  const { db, isReady } = useDatabase();
  
  // Always check if database is ready
  useEffect(() => {
    if (isReady && db) {
      // Execute queries here
    }
  }, [db, isReady]);
  
  // ... rest of component
};
```

## 2. Query Methods

The database wrapper provides three main methods:

### A. `.all()` - Get Multiple Rows (SELECT)

Returns an array of all matching rows.

```javascript
// Get all companies
const companies = db.prepare('SELECT * FROM companies ORDER BY name').all();

// With parameters
const products = db.prepare('SELECT * FROM products WHERE company_id = ?').all(companyId);

// With multiple parameters
const sales = db.prepare(`
  SELECT * FROM sales 
  WHERE sale_date >= ? AND sale_date <= ?
`).all(startDate, endDate);
```

**Example:**
```javascript
const loadProducts = () => {
  try {
    const result = db.prepare(`
      SELECT p.*, c.name as company_name 
      FROM products p 
      LEFT JOIN companies c ON p.company_id = c.id 
      ORDER BY p.created_at DESC
    `).all();
    setProducts(Array.isArray(result) ? result : []);
  } catch (error) {
    console.error('Error loading products:', error);
    setProducts([]);
  }
};
```

### B. `.get()` - Get Single Row (SELECT)

Returns a single row object or `null` if no match.

```javascript
// Get a single company
const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);

// Get product by SKU
const product = db.prepare('SELECT * FROM products WHERE sku = ?').get(sku);
```

**Example:**
```javascript
const getProduct = (productId) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    return product;
  } catch (error) {
    console.error('Error getting product:', error);
    return null;
  }
};
```

### C. `.run()` - Execute (INSERT, UPDATE, DELETE)

Executes a query that modifies data. Returns `{ lastInsertRowid, changes }`.

```javascript
// INSERT
db.prepare('INSERT INTO companies (name, description) VALUES (?, ?)')
  .run(companyName, description);

// UPDATE
db.prepare('UPDATE products SET sale_price = ? WHERE id = ?')
  .run(newPrice, productId);

// DELETE
db.prepare('DELETE FROM products WHERE id = ?').run(productId);
```

**Example:**
```javascript
const handleSubmit = (e) => {
  e.preventDefault();
  
  try {
    if (editingProduct) {
      // UPDATE
      db.prepare(`
        UPDATE products 
        SET name = ?, sale_price = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(formData.name, formData.sale_price, editingProduct.id);
    } else {
      // INSERT
      db.prepare(`
        INSERT INTO products (company_id, name, sale_price)
        VALUES (?, ?, ?)
      `).run(formData.company_id, formData.name, formData.sale_price);
    }
    
    // Reload data after modification
    loadProducts();
  } catch (error) {
    console.error('Error saving product:', error);
    alert('Error saving product.');
  }
};
```

## 3. Common Query Patterns

### Insert with Auto-increment ID

```javascript
const insertCompany = (name, description) => {
  try {
    const result = db.prepare('INSERT INTO companies (name, description) VALUES (?, ?)').run(name, description);
    const newId = result.lastInsertRowid;
    return newId;
  } catch (error) {
    console.error('Error inserting company:', error);
    throw error;
  }
};
```

### Update with Timestamp

```javascript
db.prepare(`
  UPDATE products 
  SET name = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`).run(newName, productId);
```

### Delete with Confirmation

```javascript
const handleDelete = (id) => {
  if (window.confirm('Are you sure you want to delete this item?')) {
    try {
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      loadProducts(); // Reload list
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Cannot delete product. It may have associated records.');
    }
  }
};
```

### Complex JOIN Query

```javascript
const loadSalesWithDetails = () => {
  try {
    const sales = db.prepare(`
      SELECT 
        s.*,
        c.name as customer_name,
        COUNT(si.id) as item_count,
        SUM(si.subtotal) as total_items
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      GROUP BY s.id
      ORDER BY s.sale_date DESC
    `).all();
    return sales;
  } catch (error) {
    console.error('Error loading sales:', error);
    return [];
  }
};
```

### Conditional Queries

```javascript
const searchProducts = (searchTerm, companyId = null) => {
  try {
    let query = 'SELECT * FROM products WHERE name LIKE ?';
    let params = [`%${searchTerm}%`];
    
    if (companyId) {
      query += ' AND company_id = ?';
      params.push(companyId);
    }
    
    query += ' ORDER BY name';
    
    return db.prepare(query).all(...params);
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
};
```

## 4. Error Handling

Always wrap database operations in try-catch blocks:

```javascript
const loadData = () => {
  try {
    const result = db.prepare('SELECT * FROM table_name').all();
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Database error:', error);
    // Return safe default value
    return [];
  }
};
```

## 5. Best Practices

1. **Always check `isReady`** before executing queries
2. **Use parameterized queries** to prevent SQL injection
3. **Handle errors gracefully** with try-catch
4. **Validate data** before inserting/updating
5. **Reload data** after INSERT/UPDATE/DELETE operations
6. **Use transactions** for multiple related operations (if needed)

## 6. Testing Queries in Browser Console

You can test queries directly in the browser console:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Access the database context:

```javascript
// The database is available through React DevTools or you can add a global reference
// In your component, temporarily add:
window.testDb = db;

// Then in console:
window.testDb.prepare('SELECT * FROM companies').all();
```

## 7. Available Tables

- `companies` - Company information
- `products` - Product catalog
- `inventory` - Inventory transactions
- `stock_levels` - Current stock quantities
- `customers` - Customer information
- `suppliers` - Supplier information
- `sales` - Sales records
- `sale_items` - Individual sale line items
- `payments` - Payment records
- `staff` - Staff/employee information
- `attendance` - Staff attendance records
- `expenses` - Expense records

## 8. Database Location

- **Browser mode**: In-memory database (data lost on refresh)
- **Electron mode**: Saved to `userData/bismillah_traders.db` (persistent)

The database is automatically saved after each modification when running in Electron mode.

