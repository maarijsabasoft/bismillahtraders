# Quick Start: Deploy with Shared SQLite Database

## 🚀 5-Minute Setup

### 1. Install Dependencies
```bash
npm install @vercel/blob
```

### 2. Set Up Vercel Blob Storage

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Create/Select project → **Storage** → **Create Database** → **Blob**
3. Copy the `BLOB_READ_WRITE_TOKEN`

### 3. Add Environment Variables in Vercel

Go to **Settings** → **Environment Variables** and add:

```
BLOB_READ_WRITE_TOKEN=your_token_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
REACT_APP_USE_VERCEL_DB=true
```

### 4. Deploy

```bash
# Option A: Via CLI
npm i -g vercel
vercel

# Option B: Via GitHub
# Push to GitHub, then import in Vercel dashboard
```

### 5. Test

1. Visit your deployed app
2. Login with admin credentials
3. Add some data
4. Open in another browser → Login → See same data! ✅

## ✅ That's It!

Your SQLite database is now:
- Stored on Vercel servers
- Accessible from anywhere
- Shared across all admin logins
- Automatically backed up

## 📖 Full Documentation

See `VERCEL_SETUP.md` for detailed instructions and troubleshooting.

