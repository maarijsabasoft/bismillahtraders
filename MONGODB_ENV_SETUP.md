# MongoDB Atlas Environment Variables Setup

## Your MongoDB Connection String

Based on your provided connection string, here's how to configure it:

### Connection String Format

You can use your connection string in two ways:

**Option 1: With database name in URI (Recommended)**
```
MONGODB_URI=mongodb+srv://Vercel-Admin-bismillah-traders:icmgl0XYVGM84AV5@bismillah-traders.h4761gh.mongodb.net/bismillah_traders?retryWrites=true&w=majority
```

**Option 2: Without database name (will be added automatically)**
```
MONGODB_URI=mongodb+srv://Vercel-Admin-bismillah-traders:icmgl0XYVGM84AV5@bismillah-traders.h4761gh.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=bismillah_traders
```

**Key Points:**
- Username: `Vercel-Admin-bismillah-traders`
- Password: `icmgl0XYVGM84AV5`
- Cluster: `bismillah-traders.h4761gh.mongodb.net`
- Database: `bismillah_traders` (can be in URI or separate env variable)

### Complete Environment Variables for Vercel

Add these to your Vercel project (Settings → Environment Variables):

**Using your provided connection string:**

```bash
# MongoDB Connection (your connection string - database name will be added automatically)
MONGODB_URI=mongodb+srv://Vercel-Admin-bismillah-traders:icmgl0XYVGM84AV5@bismillah-traders.h4761gh.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=bismillah_traders

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Optional: Force MongoDB usage
REACT_APP_USE_MONGODB=true
```

**Or include database name in URI:**

```bash
# MongoDB Connection (with database name in URI)
MONGODB_URI=mongodb+srv://Vercel-Admin-bismillah-traders:icmgl0XYVGM84AV5@bismillah-traders.h4761gh.mongodb.net/bismillah_traders?retryWrites=true&w=majority

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Optional: Force MongoDB usage
REACT_APP_USE_MONGODB=true
```

Both options work! The code will automatically handle adding the database name if it's not in the URI.

### Verification Steps

1. **Test Connection** - After deploying, check Vercel function logs
2. **Initialize Collections** - Call `/api/db/mongodb-setup` endpoint
3. **Test Operations** - Try creating a company or product

### Quick Test Script

After deploying, test the connection:

```javascript
// In browser console (after logging in)
fetch('/api/db/mongodb-setup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa('admin:admin123')
  }
})
.then(r => r.json())
.then(data => {
  console.log('Setup result:', data);
  if (data.success) {
    console.log('✅ MongoDB setup successful!');
  } else {
    console.error('❌ Setup failed:', data);
  }
});
```

### Troubleshooting

**Connection Error?**
- Verify the connection string includes the database name
- Check MongoDB Atlas network access allows `0.0.0.0/0` (all IPs)
- Verify the username and password are correct

**Authentication Error?**
- Make sure `ADMIN_USERNAME` and `ADMIN_PASSWORD` match your login credentials
- Check that you're logged in before making API calls

**Collections Not Created?**
- Call the `/api/db/mongodb-setup` endpoint
- Check Vercel function logs for errors
- Verify `MONGODB_URI` is set correctly

### Security Note

⚠️ **Important**: The connection string contains sensitive credentials. Make sure:
- It's only stored in Vercel environment variables
- Never commit it to Git
- Use strong passwords in production

---

**Next Step**: Deploy your application and call the setup endpoint to initialize collections!

