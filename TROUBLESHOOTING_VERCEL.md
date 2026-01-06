# Troubleshooting: Data Not Storing in Production

## 🔍 Quick Diagnosis

### Step 1: Check Browser Console

Open browser DevTools (F12) and check the console. You should see one of these messages:

✅ **Working:**
```
Using Vercel serverless database
Vercel DB: Initializing Vercel database wrapper
```

❌ **Not Working:**
```
Using local database
Vercel DB: Not detected as Vercel deployment
```

### Step 2: Check Network Tab

1. Open DevTools → **Network** tab
2. Try to add/save data
3. Look for requests to `/api/db/query`

**If you see:**
- ✅ Request to `/api/db/query` → API is being called
- ❌ No request → Database not using Vercel API
- ❌ 401 Unauthorized → Authentication issue
- ❌ 500 Error → Server/Blob storage issue

## 🐛 Common Issues & Fixes

### Issue 1: Not Using Vercel Database

**Symptoms:**
- Console shows "Using local database"
- Data stored in browser IndexedDB (not shared)

**Fix:**
1. Go to Vercel Dashboard → **Settings** → **Environment Variables**
2. Add: `REACT_APP_USE_VERCEL_DB=true`
3. **Redeploy** your application

### Issue 2: Authentication Failing

**Symptoms:**
- Console shows "Not authenticated"
- 401 errors in Network tab

**Fix:**
1. **Login first** - You must be logged in as admin
2. Check environment variables match:
   - `ADMIN_USERNAME` = `REACT_APP_ADMIN_USERNAME`
   - `ADMIN_PASSWORD` = `REACT_APP_ADMIN_PASSWORD`
3. Verify credentials in Vercel match what you're using to login

### Issue 3: Blob Storage Not Configured

**Symptoms:**
- 500 errors in Network tab
- Console shows "BLOB_READ_WRITE_TOKEN not configured"

**Fix:**
1. Go to Vercel Dashboard → **Storage** → Create Blob if not exists
2. Copy `BLOB_READ_WRITE_TOKEN`
3. Go to **Settings** → **Environment Variables**
4. Add: `BLOB_READ_WRITE_TOKEN=your_token_here`
5. **Redeploy**

### Issue 4: API Route Not Found

**Symptoms:**
- 404 errors for `/api/db/query`
- API route not deployed

**Fix:**
1. Ensure `api/db/query.js` exists in your project
2. Push to GitHub
3. Vercel will auto-deploy
4. Check **Deployments** → **Functions** to see if route exists

### Issue 5: CORS Issues

**Symptoms:**
- CORS errors in console
- Requests blocked

**Fix:**
- Should be handled automatically by API route
- Check `api/db/query.js` has CORS headers (it does)

## ✅ Verification Checklist

Run through this checklist:

- [ ] Environment variable `REACT_APP_USE_VERCEL_DB=true` is set in Vercel
- [ ] Environment variable `BLOB_READ_WRITE_TOKEN` is set in Vercel
- [ ] Environment variables `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set
- [ ] Environment variables `REACT_APP_ADMIN_USERNAME` and `REACT_APP_ADMIN_PASSWORD` are set
- [ ] You are **logged in** as admin in the app
- [ ] Console shows "Using Vercel serverless database"
- [ ] Network tab shows requests to `/api/db/query`
- [ ] API requests return 200 (not 401, 404, or 500)
- [ ] Application has been **redeployed** after setting environment variables

## 🔧 Debug Steps

### 1. Check Environment Variables

In Vercel Dashboard:
1. Go to **Settings** → **Environment Variables**
2. Verify all required variables are set
3. Check they're enabled for **Production** environment

### 2. Check Function Logs

1. Go to **Deployments** → Select latest deployment
2. Click **Functions** tab
3. Click on `api/db/query`
4. Check **Logs** for errors

### 3. Test API Directly

You can test the API directly using curl:

```bash
curl -X POST https://your-app.vercel.app/api/db/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'admin:your_password' | base64)" \
  -d '{
    "method": "all",
    "sql": "SELECT * FROM expenses LIMIT 1"
  }'
```

Replace:
- `your-app.vercel.app` with your actual URL
- `your_password` with your admin password

### 4. Check Browser Console

Look for these specific messages:

**Good:**
```
Vercel DB: Initializing Vercel database wrapper
Vercel DB: Making request to /api/db/query
Vercel DB: Operation successful
```

**Bad:**
```
Vercel DB: Not detected as Vercel deployment
Vercel DB: Not authenticated
Vercel DB: API error 401
Vercel DB: API error 500
```

## 🚨 Still Not Working?

If data still isn't storing:

1. **Check Vercel Function Logs:**
   - Go to **Deployments** → **Functions** → **Logs**
   - Look for error messages

2. **Verify Blob Storage:**
   - Go to **Storage** tab
   - Check if blob exists
   - Try creating a new blob if needed

3. **Test Locally:**
   - Set `REACT_APP_USE_VERCEL_DB=true` in `.env.local`
   - Run `npm start`
   - Check if it works locally

4. **Check Build:**
   - Ensure `api/db/query.js` is in the build
   - Check Vercel build logs for errors

## 📝 Quick Fix Summary

Most common fix:

1. **Add environment variable:** `REACT_APP_USE_VERCEL_DB=true`
2. **Redeploy** application
3. **Login** as admin
4. **Test** adding data

If still not working, check the browser console and Vercel function logs for specific error messages.

