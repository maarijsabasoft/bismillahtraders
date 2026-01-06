# Vercel Deployment with SQLite Storage - Setup Guide

This guide explains how to deploy your application on Vercel with SQLite database stored on Vercel's servers, accessible from anywhere through admin login.

## 🎯 How It Works

1. **SQLite Database** is stored in **Vercel Blob Storage** (cloud storage)
2. **Vercel Serverless Functions** (API routes) handle all database operations
3. **Admin authentication** required to access the database
4. **Data is shared** - all users see the same data when logged in as admin
5. **No traditional backend** - uses serverless functions only

## 📋 Prerequisites

1. Vercel account (free tier works)
2. Node.js 18+ installed locally
3. Git repository (GitHub recommended)

## 🚀 Setup Steps

### Step 1: Install Dependencies

```bash
npm install @vercel/blob
```

### Step 2: Set Up Vercel Blob Storage

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (or create new)
3. Go to **Storage** tab
4. Click **Create Database** → Select **Blob**
5. Name it (e.g., `bismillah-traders-blob`)
6. Copy the **BLOB_READ_WRITE_TOKEN** (you'll need this)

### Step 3: Configure Environment Variables

In your Vercel project settings:

1. Go to **Settings** → **Environment Variables**
2. Add these variables:

```
BLOB_READ_WRITE_TOKEN=your_blob_token_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

**⚠️ Important:** Change `ADMIN_PASSWORD` to a strong password!

### Step 4: Update API Route (if needed)

The API route at `api/db/query.js` should automatically use the blob storage. Make sure it has access to the token:

```javascript
// The @vercel/blob package automatically uses BLOB_READ_WRITE_TOKEN
// from environment variables
```

### Step 5: Deploy to Vercel

#### Option A: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

#### Option B: Deploy via GitHub

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click **Add New Project**
4. Import your GitHub repository
5. Vercel will auto-detect React and deploy

### Step 6: Enable Vercel Database Mode

After deployment, set an environment variable in Vercel:

1. Go to **Settings** → **Environment Variables**
2. Add:
   ```
   REACT_APP_USE_VERCEL_DB=true
   ```
3. Redeploy your application

## 🔐 Security Notes

1. **Change Default Password**: Update `ADMIN_PASSWORD` in environment variables
2. **Use HTTPS**: Vercel automatically provides HTTPS
3. **API Authentication**: All API routes require Basic Auth with admin credentials
4. **Environment Variables**: Never commit secrets to Git

## 📁 Project Structure

```
your-project/
├── api/
│   └── db/
│       └── query.js          # Serverless function for database operations
├── src/
│   ├── utils/
│   │   ├── database.js       # Local database (Electron/IndexedDB)
│   │   └── database-vercel.js # Vercel database wrapper
│   └── context/
│       └── DatabaseContext.js # Auto-detects and uses Vercel DB
├── vercel.json               # Vercel configuration
└── package.json
```

## 🔄 How Database Operations Work

1. **Frontend** makes API call to `/api/db/query`
2. **Serverless Function**:
   - Downloads SQLite file from Blob Storage
   - Executes SQL query using sql.js
   - Saves updated database back to Blob Storage
   - Returns result to frontend
3. **Frontend** receives and displays data

## ✅ Testing

1. Deploy to Vercel
2. Visit your app URL
3. Login with admin credentials
4. Add some data (expenses, products, etc.)
5. Open app in another browser/device
6. Login again - you should see the same data!

## 🐛 Troubleshooting

### Database not saving?

- Check `BLOB_READ_WRITE_TOKEN` is set correctly
- Check Vercel function logs: **Deployments** → **Functions** → **View Logs**

### Authentication failing?

- Verify `ADMIN_USERNAME` and `ADMIN_PASSWORD` match in environment variables
- Check browser console for errors

### API route not found?

- Ensure `api/db/query.js` is in the root directory
- Check `vercel.json` configuration
- Redeploy after changes

### Slow performance?

- First request may be slow (cold start)
- Subsequent requests are faster
- Consider upgrading Vercel plan for better performance

## 💰 Cost Considerations

**Free Tier Limits:**
- 100GB bandwidth/month
- 100GB-hours function execution
- 1GB Blob storage

For most small-medium businesses, the free tier is sufficient.

## 🔄 Migration from Local to Vercel

1. **Export local data** (if you have any):
   - Use browser DevTools → Application → IndexedDB
   - Or export from Electron app

2. **Deploy to Vercel** (empty database will be created)

3. **Import data** (if needed):
   - You may need to create an import script
   - Or manually re-enter critical data

## 📝 Environment Variables Summary

Required in Vercel:
```
BLOB_READ_WRITE_TOKEN=your_token
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password
REACT_APP_USE_VERCEL_DB=true
```

## 🎉 Success!

Once deployed, your SQLite database will be:
- ✅ Stored on Vercel servers
- ✅ Accessible from anywhere
- ✅ Shared across all admin logins
- ✅ Automatically backed up
- ✅ No backend server needed!

## 📞 Support

If you encounter issues:
1. Check Vercel function logs
2. Check browser console
3. Verify environment variables
4. Ensure all dependencies are installed

