# MongoDB Atlas Setup Guide

## Fast, Reliable Database Solution for Web Applications

This guide will help you set up **MongoDB Atlas** - a fast, serverless document database that works perfectly for multi-device web applications.

## Why MongoDB Atlas?

✅ **Fast** - No timeouts, sub-second response times  
✅ **Reliable** - Managed by MongoDB, industry-standard database  
✅ **Multi-device** - Multiple users can access the same data  
✅ **Serverless** - No backend management needed  
✅ **Free Tier** - Generous free tier (512 MB storage)  
✅ **Scalable** - Automatically scales with your needs  
✅ **Flexible** - Document-based, easy to work with  

## Setup Steps

### 1. Install Dependencies

```bash
npm install mongodb
```

### 2. Create MongoDB Atlas Cluster

1. Go to MongoDB Atlas: https://www.mongodb.com/cloud/atlas
2. Sign up for a free account (or log in)
3. Click **"Build a Database"**
4. Choose **FREE (M0) Shared** cluster
5. Select a cloud provider and region (choose closest to your users)
6. Click **"Create"**

### 3. Create Database User

1. Go to **Database Access** in the left sidebar
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter username and password (save these!)
5. Set privileges to **"Atlas admin"** or **"Read and write to any database"**
6. Click **"Add User"**

### 4. Configure Network Access

1. Go to **Network Access** in the left sidebar
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (for Vercel deployment)
   - Or add specific IPs: `0.0.0.0/0` for all IPs
4. Click **"Confirm"**

### 5. Get Connection String

1. Go to **Database** in the left sidebar
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Copy the connection string
   - It looks like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. Replace `<password>` with your actual password
6. Add database name at the end: `mongodb+srv://...mongodb.net/bismillah_traders?retryWrites=true&w=majority`

### 6. Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Go to **Settings** → **Environment Variables**
3. Add these variables:

```
MONGODB_URI=mongodb+srv://Vercel-Admin-bismillah-traders:icmgl0XYVGM84AV5@bismillah-traders.h4761gh.mongodb.net/bismillah_traders?retryWrites=true&w=majority
MONGODB_DB_NAME=bismillah_traders
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

**Important**: 
- Make sure to add the database name (`bismillah_traders`) before the `?` in the connection string
- Your connection string should end with: `...mongodb.net/bismillah_traders?retryWrites=true&w=majority`

### 7. Initialize Database Collections

After deploying, visit your API endpoint to create collections and indexes:

```
POST https://your-domain.vercel.app/api/db/mongodb-setup
```

**With authentication:**
- Username: `admin` (or your `ADMIN_USERNAME`)
- Password: `admin123` (or your `ADMIN_PASSWORD`)

You can use curl, Postman, or your browser's developer console:

```javascript
// In browser console after logging in
fetch('/api/db/mongodb-setup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa('admin:admin123')
  }
})
.then(r => r.json())
.then(console.log);
```

### 8. Enable MongoDB in Your App

The app will automatically use MongoDB when:
- Deployed on Vercel (detected by hostname)
- OR set `REACT_APP_USE_MONGODB=true` in environment variables

## Environment Variables

Add these to your Vercel project settings:

```
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/bismillah_traders?retryWrites=true&w=majority
MONGODB_DB_NAME=bismillah_traders
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
REACT_APP_USE_MONGODB=true  # Optional: Force MongoDB usage
```

## How It Works

1. **Client-side**: Your React app uses `database-mongodb.js` wrapper
2. **API Route**: `/api/db/mongodb` handles all database operations
3. **MongoDB Atlas**: Stores all data securely in the cloud
4. **Multi-device**: Any device with admin login can access the same data

## Database Collections

The setup script creates these collections with indexes:
- `companies` - Company information
- `products` - Product catalog
- `inventory` - Inventory transactions
- `stock_levels` - Current stock levels
- `customers` - Customer information
- `suppliers` - Supplier information
- `sales` - Sales records
- `sale_items` - Sale line items
- `payments` - Payment records
- `staff` - Staff/employee information
- `attendance` - Attendance records
- `expenses` - Expense records

## Data Structure

MongoDB uses documents (like JSON objects) instead of rows. Each document has:
- `_id`: Unique identifier (automatically generated)
- `id`: String version of `_id` (for compatibility)
- Other fields: Same as your SQL tables

Example document:
```json
{
  "_id": ObjectId("..."),
  "id": "...",
  "name": "Company Name",
  "description": "Description",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Performance

- **Query Speed**: < 100ms for most queries
- **No Timeouts**: Unlike SQLite blob storage
- **Concurrent Users**: Supports multiple simultaneous users
- **Scalability**: Automatically scales with your needs
- **Indexes**: Optimized indexes for fast queries

## Cost

- **Free Tier (M0)**: 
  - 512 MB storage
  - Shared RAM and vCPU
  - Perfect for small to medium applications
  - **FREE forever**

- **Paid Plans**: 
  - Start at $9/month for M10 cluster
  - More storage and performance
  - Dedicated resources

## Troubleshooting

### Connection errors?
- Verify `MONGODB_URI` is set correctly in Vercel
- Check that your IP is whitelisted (or use 0.0.0.0/0)
- Verify database user credentials are correct
- Check MongoDB Atlas cluster is running

### Collections not created?
- Make sure you've called `/api/db/mongodb-setup` endpoint
- Check Vercel function logs for errors
- Verify MongoDB connection string is correct

### Authentication errors?
- Verify `ADMIN_USERNAME` and `ADMIN_PASSWORD` match
- Check Basic Auth header is being sent correctly

### Timeout errors?
- MongoDB Atlas is very fast, timeouts are rare
- Check your MongoDB cluster region matches your Vercel region
- Verify network connectivity

## Security Best Practices

1. **Use strong passwords** for database users
2. **Restrict IP access** if possible (or use Vercel IP ranges)
3. **Use environment variables** - never commit credentials
4. **Enable MongoDB Atlas encryption** at rest
5. **Regular backups** - MongoDB Atlas provides automatic backups

## Migration from SQLite

If you have existing SQLite data:

1. Export data from SQLite (if using Electron)
2. Convert to MongoDB documents
3. Import using MongoDB Compass or API
4. Or start fresh - MongoDB will create empty collections

## Support

For issues:
1. Check Vercel function logs
2. Check MongoDB Atlas cluster status
3. Verify connection string format
4. Test API endpoint directly with Postman/curl

## Next Steps

1. ✅ Install `mongodb` package
2. ✅ Create MongoDB Atlas cluster
3. ✅ Configure database user and network access
4. ✅ Add environment variables to Vercel
5. ✅ Deploy your application
6. ✅ Call `/api/db/mongodb-setup` to create collections
7. ✅ Start using your fast, reliable database!

---

**Note**: This is the fastest and most reliable solution for web applications. MongoDB Atlas handles all the database management for you!

