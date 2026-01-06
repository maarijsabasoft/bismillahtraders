# Quick Start: Enable Vercel Sync in Electron

## 🚀 3-Step Setup

### Step 1: Create `.env` File

Create a `.env` file in your project root:

```env
REACT_APP_ELECTRON_VERCEL_SYNC=true
REACT_APP_API_URL=https://your-app.vercel.app/api/db/query
REACT_APP_ADMIN_USERNAME=admin
REACT_APP_ADMIN_PASSWORD=your_password
```

**Replace:**
- `your-app.vercel.app` with your actual Vercel deployment URL
- `your_password` with your admin password (same as Vercel)

### Step 2: Rebuild

```bash
npm run build
```

### Step 3: Run Electron

```bash
npm run electron
```

## ✅ Verify It's Working

1. **Check console** - Should see:
   ```
   Electron: Vercel sync enabled - using cloud database
   Electron: Connected to Vercel database
   ```

2. **Test sync:**
   - Add data in Electron
   - Open Vercel website → See same data! ✅
   - Add data on Vercel website
   - Refresh Electron → See same data! ✅

## 🔄 Disable Sync (Use Local Database)

Remove or set to `false`:
```env
REACT_APP_ELECTRON_VERCEL_SYNC=false
```

## 📝 Full Documentation

See `ELECTRON_VERCEL_SYNC.md` for detailed instructions.

