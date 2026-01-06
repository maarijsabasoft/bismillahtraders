# Vercel Deployment Guide - SQLite Behavior

## 🎯 Two Deployment Options

### Option 1: Shared Database on Vercel (Recommended) ⭐

**NEW:** Your app now supports **shared SQLite database stored on Vercel servers**!

- ✅ Data stored on Vercel Blob Storage
- ✅ Accessible from anywhere with admin login
- ✅ All users see the same data
- ✅ Automatic backups
- ✅ No data loss

**See `VERCEL_SETUP.md` for complete setup instructions.**

### Option 2: Local Browser Storage (Original)

Your application uses **sql.js** (SQLite compiled to WebAssembly), which runs entirely in the browser. This means:

#### ✅ **It WILL Work on Vercel**

- `sql.js` runs client-side, so it works perfectly on Vercel
- No server-side database setup needed
- No backend API required

#### 📦 **Storage Behavior**

When deployed to Vercel (without Vercel DB setup), your database will:

1. **Use IndexedDB** (browser storage) instead of file system
2. **Persist in each user's browser** - data survives page refreshes
3. **Be isolated per user** - each user has their own separate database
4. **Work offline** - once loaded, the app works without internet

#### ⚠️ **Important Limitations**

##### 1. **No Shared Data**
- Each user has their own isolated database
- User A's data is NOT visible to User B
- This is a **single-user application** when deployed to Vercel

##### 2. **Data Loss Scenarios**
- User clears browser data → Database is lost
- User uses incognito/private mode → Database cleared on close
- User switches browsers → New database (data doesn't transfer)
- User clears IndexedDB → Database is lost

##### 3. **No Server-Side Persistence**
- Data only exists in the user's browser
- No backup on server
- No data recovery if browser data is lost

### 🔄 **Current Implementation**

Your `database.js` already handles this correctly:

```javascript
// On Vercel, this code path will execute:
if (!dbData && typeof window !== 'undefined' && window.indexedDB) {
  // Loads from IndexedDB (browser storage)
  const storedData = await loadFromIndexedDB();
}
```

The database automatically:
- ✅ Saves to IndexedDB after each operation
- ✅ Loads from IndexedDB on app start
- ✅ Works without any code changes

### 🚀 **Deployment Steps**

1. **Build your React app:**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel:**
   - Connect your GitHub repo to Vercel
   - Vercel will auto-detect React and build it
   - No special configuration needed!

3. **That's it!** The app will work with IndexedDB automatically

### 💡 **When This Setup is Perfect**

✅ **Single-user applications** (personal finance, notes, etc.)
✅ **Offline-first apps** (works without internet)
✅ **Privacy-focused apps** (data never leaves user's device)
✅ **Demo/prototype apps** (quick deployment, no backend)

### ❌ **When You Need a Backend Database**

If you need:
- **Shared data** between users
- **Server-side backups**
- **Multi-user collaboration**
- **Data recovery** capabilities

Then use **Option 1** (Shared Database on Vercel) - see `VERCEL_SETUP.md`

### 🔧 **Migration Options (If Needed)**

#### Option 1: Supabase (Recommended)
- Free tier available
- PostgreSQL database
- Real-time subscriptions
- Easy migration path

#### Option 2: Firebase Firestore
- NoSQL database
- Real-time updates
- Good for React apps

#### Option 3: Custom Backend
- Node.js + Express + PostgreSQL
- Full control
- More setup required

### 📝 **Summary**

**For Vercel deployment (Option 2 - Local Storage):**
- ✅ Your current setup works **as-is**
- ✅ No code changes needed
- ✅ Each user gets isolated database in their browser
- ⚠️ Data is NOT shared between users
- ⚠️ Data only exists in user's browser

**For Vercel deployment (Option 1 - Shared Database):**
- ✅ See `VERCEL_SETUP.md` for setup
- ✅ Data stored on Vercel servers
- ✅ Shared across all admin logins
- ✅ Accessible from anywhere

