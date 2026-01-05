# Installation Instructions

## Quick Fix for better-sqlite3 Error

The application has been updated to use `sql.js` instead of `better-sqlite3` to avoid native compilation issues on Windows.

## Steps to Install

1. **Remove old packages** (if installed):
```bash
npm uninstall better-sqlite3
```

2. **Install sql.js**:
```bash
npm install sql.js
```

3. **Install all dependencies**:
```bash
npm install
```

4. **Run the application**:
```bash
npm start
```

Then in another terminal:
```bash
npm run electron
```

## What Changed

- Replaced `better-sqlite3` with `sql.js` (pure JavaScript, no native compilation needed)
- Updated database initialization to work with sql.js
- Database is saved to user data directory automatically
- All database operations are now async (using Promises)

## Database Location

The database file (`farhan_traders.db`) will be saved in:
- **Windows**: `%APPDATA%/farhan-traders/farhan_traders.db`
- **macOS**: `~/Library/Application Support/farhan-traders/farhan_traders.db`
- **Linux**: `~/.config/farhan-traders/farhan_traders.db`

## Troubleshooting

If you still see errors:
1. Delete `node_modules` folder
2. Delete `package-lock.json`
3. Run `npm install` again

The application will work without any Visual Studio build tools!

