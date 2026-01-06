# Vercel Postgres Setup Guide

## Fast, Reliable Database Solution for Web Applications

This guide will help you set up **Vercel Postgres** - a fast, serverless PostgreSQL database that works perfectly for multi-device web applications.

## Why Vercel Postgres?

✅ **Fast** - No timeouts, sub-second response times  
✅ **Reliable** - Built on PostgreSQL, industry-standard database  
✅ **Multi-device** - Multiple users can access the same data  
✅ **Serverless** - No backend management needed  
✅ **Free Tier** - Generous free tier for small applications  

## Setup Steps

### 1. Install Dependencies

```bash
npm install @vercel/postgres
```

### 2. Create Vercel Postgres Database

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to **Storage** tab
4. Click **Create Database**
5. Select **Postgres**
6. Choose a name (e.g., `bismillah-traders-db`)
7. Select a region closest to your users
8. Click **Create**

### 3. Link Database to Your Project

The database connection will be automatically available in your Vercel project environment variables:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

### 4. Initialize Database Tables

After deploying, visit your API endpoint to create tables:

```
POST https://your-domain.vercel.app/api/db/setup
```

**With authentication:**
- Username: `admin` (or your `ADMIN_USERNAME`)
- Password: `admin123` (or your `ADMIN_PASSWORD`)

You can use curl, Postman, or your browser's developer console:

```javascript
// In browser console after logging in
fetch('/api/db/setup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa('admin:admin123')
  }
})
.then(r => r.json())
.then(console.log);
```

### 5. Enable Postgres in Your App

The app will automatically use Postgres when:
- Deployed on Vercel (detected by hostname)
- OR set `REACT_APP_USE_POSTGRES=true` in environment variables

## Environment Variables

Add these to your Vercel project settings:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
REACT_APP_USE_POSTGRES=true  # Optional: Force Postgres usage
```

## How It Works

1. **Client-side**: Your React app uses `database-postgres.js` wrapper
2. **API Route**: `/api/db/postgres` handles all database operations
3. **Postgres**: Vercel Postgres stores all data securely
4. **Multi-device**: Any device with admin login can access the same data

## Database Schema

The setup script creates these tables:
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

## Migration from SQLite

If you have existing SQLite data:

1. Export data from SQLite (if using Electron)
2. Create a migration script to import into Postgres
3. Or start fresh - Postgres will create empty tables

## Performance

- **Query Speed**: < 100ms for most queries
- **No Timeouts**: Unlike SQLite blob storage
- **Concurrent Users**: Supports multiple simultaneous users
- **Scalability**: Automatically scales with your needs

## Cost

- **Free Tier**: 
  - 256 MB storage
  - 60 hours compute/month
  - Perfect for small to medium applications

- **Pro Plan**: 
  - 10 GB storage
  - Unlimited compute
  - $20/month

## Troubleshooting

### Tables not created?
- Make sure you've called `/api/db/setup` endpoint
- Check Vercel logs for errors
- Verify database is linked to your project

### Connection errors?
- Verify `POSTGRES_URL` is set in Vercel environment
- Check database is active in Vercel dashboard
- Ensure you're using the correct region

### Authentication errors?
- Verify `ADMIN_USERNAME` and `ADMIN_PASSWORD` match
- Check Basic Auth header is being sent correctly

## Support

For issues:
1. Check Vercel function logs
2. Verify database connection in Vercel dashboard
3. Test API endpoint directly with Postman/curl

## Next Steps

1. ✅ Install `@vercel/postgres`
2. ✅ Create Postgres database in Vercel
3. ✅ Deploy your application
4. ✅ Call `/api/db/setup` to create tables
5. ✅ Start using your fast, reliable database!

---

**Note**: This replaces the slow SQLite blob storage solution with a much faster Postgres database.

