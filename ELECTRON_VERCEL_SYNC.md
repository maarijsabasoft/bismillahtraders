# Electron App with Vercel Database Sync

## 🎯 Overview

Your Electron app can now **sync with the Vercel deployed version** in real-time! This means:

- ✅ **Live Updates**: Changes in Electron app sync to Vercel
- ✅ **Live Updates**: Changes on Vercel website sync to Electron app
- ✅ **Same Data**: Both use the same cloud database
- ✅ **Accessible Anywhere**: Login from any device, see same data

## 🔄 How It Works

### Option 1: Electron Uses Vercel Database (Recommended) ⭐

When enabled, your Electron app connects directly to the Vercel database via API:

```
Electron App → API Calls → Vercel Serverless Function → Vercel Blob Storage
```

**Benefits:**
- ✅ Real-time sync with web version
- ✅ Data accessible from anywhere
- ✅ Automatic backups
- ✅ No local database file needed

### Option 2: Local Database (Offline Mode)

Electron uses local SQLite file (no sync):

```
Electron App → Local SQLite File
```

**Benefits:**
- ✅ Works offline
- ✅ Faster (no network calls)
- ✅ Private (data stays local)

## 🚀 Setup Instructions

### Step 1: Enable Vercel Sync in Electron

You have **two ways** to enable sync:

#### Method A: Environment Variable (Recommended)

Create a `.env` file in your project root:

```env
REACT_APP_ELECTRON_VERCEL_SYNC=true
REACT_APP_API_URL=https://your-app.vercel.app/api/db/query
REACT_APP_ADMIN_USERNAME=admin
REACT_APP_ADMIN_PASSWORD=your_password
```

#### Method B: Runtime Toggle (Coming Soon)

You can add a settings UI to toggle sync on/off in the Electron app.

### Step 2: Configure API URL

If your Vercel app is deployed at `https://your-app.vercel.app`, set:

```env
REACT_APP_API_URL=https://your-app.vercel.app/api/db/query
```

Or it will default to `/api/db/query` (relative URL - only works if Electron loads from Vercel).

### Step 3: Build and Test

1. **Build your React app:**
   ```bash
   npm run build
   ```

2. **Run Electron:**
   ```bash
   npm run electron
   ```

3. **Check console:**
   - Should see: `Electron: Vercel sync enabled - using cloud database`
   - Or: `Electron: Using local database`

## 🔍 How to Verify Sync is Working

### Test 1: Electron → Vercel

1. Open Electron app (with sync enabled)
2. Login with admin credentials
3. Add an expense
4. Open Vercel website in browser
5. Login → **You should see the expense!** ✅

### Test 2: Vercel → Electron

1. Open Vercel website
2. Login and add an expense
3. Refresh Electron app (or wait a few seconds)
4. **You should see the new expense!** ✅

## ⚙️ Configuration Options

### Enable Sync (Environment Variable)

```env
REACT_APP_ELECTRON_VERCEL_SYNC=true
```

### Disable Sync (Use Local Database)

```env
REACT_APP_ELECTRON_VERCEL_SYNC=false
```

Or remove the variable (defaults to local).

### Custom API URL

```env
REACT_APP_API_URL=https://your-custom-domain.com/api/db/query
```

## 📊 Database Modes

The app automatically detects and uses the right mode:

| Environment | Mode | Database Location |
|------------|------|-------------------|
| Electron + Sync ON | `vercel` | Vercel Blob Storage |
| Electron + Sync OFF | `local` | Local SQLite file |
| Vercel Web | `vercel` | Vercel Blob Storage |
| Local Browser | `local` | IndexedDB |

## 🔐 Authentication

When using Vercel sync in Electron, you need to login with the same admin credentials:

- **Username**: `admin` (or from `REACT_APP_ADMIN_USERNAME`)
- **Password**: Your password (from `REACT_APP_ADMIN_PASSWORD`)

These must match the Vercel environment variables:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## 🐛 Troubleshooting

### Electron not syncing?

1. **Check environment variable:**
   ```bash
   # In .env file
   REACT_APP_ELECTRON_VERCEL_SYNC=true
   ```

2. **Check API URL:**
   - Must point to your Vercel deployment
   - Format: `https://your-app.vercel.app/api/db/query`

3. **Check console logs:**
   - Should see: `Electron: Vercel sync enabled`
   - If you see: `Electron: Using local database` → sync is disabled

4. **Check authentication:**
   - Login with admin credentials
   - Credentials must match Vercel environment variables

### Network errors?

- **Check internet connection**
- **Verify Vercel app is deployed and accessible**
- **Check API URL is correct**
- **Check CORS settings** (should work automatically)

### Data not syncing?

- **Wait a few seconds** - API calls are async
- **Refresh the app** - data loads on startup
- **Check both apps are logged in** - authentication required
- **Check Vercel function logs** - might show errors

## 💡 Best Practices

1. **Use Sync for Production:**
   - Enable sync when you want data shared across devices
   - Use local mode for offline development

2. **Backup Strategy:**
   - With sync enabled, Vercel automatically backs up data
   - With local mode, backup the SQLite file manually

3. **Performance:**
   - Sync mode: Slightly slower (network calls)
   - Local mode: Faster (no network)

4. **Security:**
   - Never commit `.env` file to Git
   - Use strong passwords
   - Keep credentials in environment variables

## 🎉 Success!

When working correctly:

- ✅ Electron app shows: `Electron: Connected to Vercel database`
- ✅ Changes in Electron appear on Vercel website
- ✅ Changes on Vercel website appear in Electron
- ✅ Same data everywhere!

## 📝 Summary

**To enable sync:**
1. Set `REACT_APP_ELECTRON_VERCEL_SYNC=true` in `.env`
2. Set `REACT_APP_API_URL` to your Vercel deployment
3. Set admin credentials in environment variables
4. Rebuild and run Electron

**Your Electron app will now sync with Vercel in real-time!** 🚀

