# Database Migration Instructions

The database has been moved to use Electron IPC for better compatibility. All database operations now need to be async.

## Quick Fix Script

Run this command to rebuild better-sqlite3 for Electron:

```bash
npm install
npm run postinstall
```

Or manually:

```bash
npx electron-rebuild -f -w better-sqlite3
```

## Changes Made

1. Database operations are now in the main Electron process (`public/database.js`)
2. IPC handlers added in `public/electron.js`
3. Database wrapper in `src/utils/database.js` now uses IPC

## Required Updates

All pages need to update database calls from:
```javascript
const result = db.prepare('SELECT ...').all();
```

To:
```javascript
const result = await db.prepare('SELECT ...').all();
```

And make the containing function async:
```javascript
const loadData = async () => {
  const result = await db.prepare('SELECT ...').all();
  // ...
};
```

## Pages That Need Updates

- ✅ Dashboard.js - Updated
- ✅ Companies.js - Updated  
- ⚠️ Products.js - Needs update
- ⚠️ Inventory.js - Needs update
- ⚠️ Customers.js - Needs update
- ⚠️ Suppliers.js - Needs update
- ⚠️ Sales.js - Needs update
- ⚠️ Invoices.js - Needs update
- ⚠️ Reports.js - Needs update
- ⚠️ Staff.js - Needs update
- ⚠️ Expenses.js - Needs update

