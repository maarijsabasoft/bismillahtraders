// Vercel Postgres API route - Fast, reliable, no timeouts
// Uses @vercel/postgres for serverless PostgreSQL

import { sql } from '@vercel/postgres';
import { verifyAuth } from './auth';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify authentication
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
  }

  try {
    const { method, query: sqlQuery, params = [] } = req.body;

    if (!method || !sqlQuery) {
      return res.status(400).json({ error: 'Method and SQL query required' });
    }

    let result;

    switch (method) {
      case 'run':
        {
          // For INSERT, UPDATE, DELETE operations
          // Vercel Postgres sql.query returns different structure
          const queryResult = await sql.query(sqlQuery, params);
          
          // Handle INSERT with RETURNING
          let lastInsertRowid = null;
          if (sqlQuery.toUpperCase().includes('RETURNING')) {
            lastInsertRowid = queryResult.rows[0]?.id || null;
          }
          
          result = {
            lastInsertRowid: lastInsertRowid,
            changes: queryResult.rowCount || 0,
          };
        }
        break;

      case 'get':
        {
          // Get single row
          const queryResult = await sql.query(sqlQuery, params);
          result = queryResult.rows[0] || null;
        }
        break;

      case 'all':
        {
          // Get all rows
          const queryResult = await sql.query(sqlQuery, params);
          result = queryResult.rows || [];
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid method. Use run, get, or all' });
    }

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Postgres error:', error);
    return res.status(500).json({
      error: 'Database operation failed',
      message: error.message,
    });
  }
}

