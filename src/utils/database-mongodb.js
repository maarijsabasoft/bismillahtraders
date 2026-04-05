// Database wrapper for MongoDB Atlas
// Fast, reliable, no timeouts - perfect for web applications

import { getAdminUsername, getAdminPassword } from './authCredentials';
import { emitDataMutation } from './dataSync';

// Get API URL
function getApiUrl() {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  return '/api/db/mongodb';
}

const API_BASE_URL = getApiUrl();
// Cold Vercel + Atlas + first TLS handshake can exceed 30s when many requests run in parallel
const FETCH_TIMEOUT = Number(process.env.REACT_APP_MONGO_FETCH_TIMEOUT_MS) || 90000;

// Fetch with timeout helper
async function fetchWithTimeout(url, options, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: The server took too long to respond');
    }
    throw error;
  }
}

// Get auth token from localStorage
function getAuthToken() {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  if (isAuthenticated === 'true') {
    const u = getAdminUsername();
    const p = getAdminPassword();
    try {
      return btoa(`${u}:${p}`);
    } catch (e) {
      console.error('MongoDB: Basic auth encoding failed (use ASCII username/password or change encoding).', e);
      return null;
    }
  }
  return null;
}

// Check if we're on Vercel
function isVercelDeployment() {
  if (typeof window === 'undefined') return false;

  if (process.env.REACT_APP_USE_MONGODB === 'true') {
    return true;
  }

  const hostname = window.location.hostname;
  if (
    hostname.includes('vercel.app') ||
    hostname.includes('vercel.com') ||
    hostname.includes('vercel.sh')
  ) {
    return true;
  }

  return false;
}

// Convert SQL-like operations to MongoDB operations
function sqlToMongoCollection(tableName) {
  // Map SQL table names to MongoDB collection names
  const collectionMap = {
    companies: 'companies',
    products: 'products',
    inventory: 'inventory',
    stock_levels: 'stock_levels',
    customers: 'customers',
    suppliers: 'suppliers',
    sales: 'sales',
    sale_items: 'sale_items',
    payments: 'payments',
    staff: 'staff',
    attendance: 'attendance',
    expenses: 'expenses',
  };
  
  return collectionMap[tableName.toLowerCase()] || tableName.toLowerCase();
}

// Parse SQL to extract table name and operation
function parseSQL(sql) {
  const upperSQL = sql.toUpperCase().trim();
  
  // Extract table name
  let tableName = null;
  const fromMatch = sql.match(/FROM\s+(\w+)/i);
  const intoMatch = sql.match(/INTO\s+(\w+)/i);
  const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
  
  if (fromMatch) tableName = fromMatch[1];
  else if (intoMatch) tableName = intoMatch[1];
  else if (updateMatch) tableName = updateMatch[1];
  
  return { tableName, sql: upperSQL };
}

async function mongoAggregateApi(authToken, coll, pipeline) {
  const response = await fetchWithTimeout(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authToken}`,
    },
    body: JSON.stringify({
      method: 'aggregate',
      collection: coll,
      filter: {},
      data: { pipeline },
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    let err;
    try {
      err = JSON.parse(errorText);
    } catch {
      err = { message: errorText };
    }
    throw new Error(err.message || err.error || `HTTP ${response.status}`);
  }
  const result = await response.json();
  return result.data || [];
}

async function mongoCountApi(authToken, coll, filter) {
  const response = await fetchWithTimeout(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authToken}`,
    },
    body: JSON.stringify({
      method: 'count',
      collection: coll,
      filter: filter || {},
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    let err;
    try {
      err = JSON.parse(errorText);
    } catch {
      err = { message: errorText };
    }
    throw new Error(err.message || err.error || `HTTP ${response.status}`);
  }
  const result = await response.json();
  return typeof result.data === 'number' ? result.data : 0;
}

/** Map Dashboard-style scalar SQL to Mongo — returns undefined if not a known pattern. */
async function tryMongoDashboardScalar(sql, flatParams, collection, authToken) {
  const norm = sql.replace(/\s+/g, ' ').trim();

  const sumField = async (coll, field) => {
    const rows = await mongoAggregateApi(authToken, coll, [
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $convert: {
                input: `$${field}`,
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);
    return Number(rows[0]?.total) || 0;
  };

  if (/^SELECT SUM\(final_amount\) AS total FROM sales$/i.test(norm)) {
    const total = await sumField(collection, 'final_amount');
    return { total };
  }

  if (
    /^SELECT SUM\(final_amount\) AS total FROM sales WHERE date\(sale_date\) = date\(\?\)$/i.test(
      norm
    )
  ) {
    const day = flatParams[0];
    if (!day) return { total: 0 };
    const rows = await mongoAggregateApi(authToken, collection, [
      {
        $addFields: {
          _saleDay: { $substrBytes: [{ $toString: { $ifNull: ['$sale_date', ''] } }, 0, 10] },
        },
      },
      { $match: { _saleDay: day } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $convert: {
                input: '$final_amount',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
      },
    ]);
    return { total: Number(rows[0]?.total) || 0 };
  }

  if (/^SELECT COUNT\(\*\) AS count FROM customers$/i.test(norm)) {
    const count = await mongoCountApi(authToken, collection, {});
    return { count };
  }

  if (/^SELECT COUNT\(\*\) AS count FROM products WHERE is_active = 1$/i.test(norm)) {
    const count = await mongoCountApi(authToken, collection, { is_active: { $in: [1, true] } });
    return { count };
  }

  if (
    /^SELECT COUNT\(\*\) AS count FROM stock_levels WHERE quantity <= low_stock_threshold$/i.test(
      norm
    )
  ) {
    const count = await mongoCountApi(authToken, collection, {
      $expr: { $lte: ['$quantity', '$low_stock_threshold'] },
    });
    return { count };
  }

  if (/^SELECT SUM\(outstanding_balance\) AS total FROM customers$/i.test(norm)) {
    const total = await sumField(collection, 'outstanding_balance');
    return { total };
  }

  return undefined;
}

// Database wrapper with better-sqlite3-like API for MongoDB
class MongoDatabaseWrapper {
  prepare(sql) {
    const { tableName, sql: upperSQL } = parseSQL(sql);
    const collection = tableName ? sqlToMongoCollection(tableName) : null;

    return {
      run: async (...params) => {
        try {
          const authToken = getAuthToken();
          if (!authToken) {
            console.error('MongoDB: Not authenticated - user must login first');
            throw new Error('Not authenticated. Please login.');
          }

          const flatParams = params.length > 0 && Array.isArray(params[0]) ? params[0] : params;
          
          let method, filter = {}, data = {};

          if (upperSQL.startsWith('INSERT')) {
            method = 'insertOne';
            // Multiline-safe: INSERT INTO t (a, b) VALUES (?, ?)
            const fullInsert = sql.match(
              /INSERT\s+INTO\s+\w+\s*\(\s*([\s\S]*?)\s*\)\s*VALUES\s*\(\s*([^)]*)\s*\)/i
            );
            if (fullInsert) {
              const columns = fullInsert[1].split(',').map((c) => c.trim()).filter(Boolean);
              columns.forEach((col, idx) => {
                if (flatParams[idx] !== undefined) {
                  data[col] = flatParams[idx];
                }
              });
            } else {
              const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
              const columnsMatch = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
              if (columnsMatch && valuesMatch) {
                const columns = columnsMatch[1].split(',').map((c) => c.trim());
                columns.forEach((col, idx) => {
                  if (flatParams[idx] !== undefined) {
                    data[col] = flatParams[idx];
                  }
                });
              }
            }
            if (Object.keys(data).length === 0) {
              throw new Error(
                'MongoDB: INSERT produced no fields (parse failed). Check SQL or open the browser Network tab for the API response.'
              );
            }
          } else if (upperSQL.startsWith('UPDATE')) {
            method = 'updateOne';
            // Parse UPDATE table SET col1 = ?, col2 = ? WHERE id = ?
            // Use multiline regex to handle SQL with newlines
            const setMatch = sql.match(/SET\s+([\s\S]*?)\s+WHERE/i) || sql.match(/SET\s+([\s\S]+)/i);
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
            
            if (setMatch) {
              const setClause = setMatch[1].trim();
              // Split by comma, but be careful with spaces and newlines
              const assignments = setClause.split(',').map(a => a.trim()).filter(a => a);
              
              let paramIndex = 0;
              assignments.forEach(assign => {
                const equalIndex = assign.indexOf('=');
                if (equalIndex === -1) return;
                
                const col = assign.substring(0, equalIndex).trim();
                const val = assign.substring(equalIndex + 1).trim();
                
                // Skip CURRENT_TIMESTAMP - will be handled by server
                if (val.toUpperCase() === 'CURRENT_TIMESTAMP' || val.toUpperCase() === 'CURRENT_TIMESTAMP()') {
                  // Server sets updated_at; do not consume a bound param
                } else if (val === '?') {
                  // This is a parameter placeholder
                  if (flatParams[paramIndex] !== undefined) {
                    data[col] = flatParams[paramIndex];
                    paramIndex++;
                  }
                }
              });
              
              // Handle WHERE clause — use the actual column (id, product_id, etc.)
              if (whereMatch) {
                const whereField = whereMatch[1];
                if (flatParams[paramIndex] !== undefined) {
                  filter[whereField] = flatParams[paramIndex];
                } else {
                  console.error('MongoDB: UPDATE WHERE parameter not found at index', paramIndex, 'Total params:', flatParams.length, 'Params:', flatParams);
                }
              } else {
                console.error('MongoDB: UPDATE WHERE clause not found in SQL:', sql);
              }
            } else {
              console.error('MongoDB: Could not parse UPDATE SET clause from SQL:', sql);
            }
          } else if (upperSQL.startsWith('DELETE')) {
            method = 'deleteOne';
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
            if (whereMatch && flatParams[0] !== undefined) {
              filter[whereMatch[1]] = flatParams[0];
            }
          } else {
            throw new Error(`Unsupported SQL operation: ${sql.substring(0, 20)}...`);
          }

          if (!collection) {
            throw new Error(
              `MongoDB: Could not resolve collection from SQL (missing FROM/INTO/UPDATE table). Snippet: ${sql.substring(0, 120)}`
            );
          }

          const requestBody = {
            method,
            collection,
            filter,
            data,
          };

          const response = await fetchWithTimeout(API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${authToken}`,
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorText = await response.text();
            let error;
            try {
              error = JSON.parse(errorText);
            } catch {
              error = { message: errorText || `HTTP ${response.status}` };
            }
            console.error('MongoDB: API error', response.status, error);
            if (response.status === 401) {
              throw new Error(
                'MongoDB API returned 401. On Vercel set ADMIN_USERNAME and ADMIN_PASSWORD to match REACT_APP_ADMIN_USERNAME and REACT_APP_ADMIN_PASSWORD (same values you use to log in).'
              );
            }
            if (response.status === 404) {
              throw new Error(
                `MongoDB API not found (404) at ${API_BASE_URL}. Use "npm run dev:vercel" for local API, or deploy api/db to Vercel. Plain "npm start" does not serve /api.`
              );
            }
            throw new Error(error.message || error.error || 'Database operation failed');
          }

          const result = await response.json();
          const payload = result.data;

          if (method === 'updateOne' && payload && payload.matchedCount === 0) {
            throw new Error(
              'Update failed: no document matched (wrong id or data was deleted).'
            );
          }
          if (method === 'deleteOne' && payload && payload.changes === 0) {
            throw new Error('Delete failed: no document matched.');
          }

          if (
            method === 'insertOne' ||
            method === 'updateOne' ||
            method === 'deleteOne' ||
            method === 'deleteMany' ||
            method === 'insertMany'
          ) {
            emitDataMutation({ collection, method });
          }

          return payload;
        } catch (error) {
          console.error('MongoDB: Database run error:', error.message, sql);
          throw error;
        }
      },
      get: async (...params) => {
        try {
          const authToken = getAuthToken();
          if (!authToken) {
            throw new Error('Not authenticated');
          }

          const flatParams = params.length > 0 && Array.isArray(params[0]) ? params[0] : params;

          if (collection) {
            const dashboardRow = await tryMongoDashboardScalar(
              sql,
              flatParams,
              collection,
              authToken
            );
            if (dashboardRow !== undefined) {
              return dashboardRow;
            }
          }

          // Parse SELECT * FROM table WHERE col = ?
          const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
          const filter = {};
          
          if (whereMatch && flatParams[0] !== undefined) {
            filter[whereMatch[1]] = flatParams[0];
          }

          const requestBody = {
            method: 'findOne',
            collection,
            filter,
          };

          const response = await fetchWithTimeout(API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${authToken}`,
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            let error;
            try {
              error = await response.json();
            } catch {
              error = { message: `HTTP ${response.status}` };
            }
            if (response.status === 504 || response.status === 408) {
              console.error('MongoDB: Get timeout:', sql, params);
              return null;
            }
            throw new Error(error.message || 'Database operation failed');
          }

          const result = await response.json();
          return result.data;
        } catch (error) {
          if (error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
            console.error('MongoDB: Get error (timeout/network):', error.message, sql, params);
            return null;
          }
          console.error('MongoDB: Get error:', error, sql, params);
          return null;
        }
      },
      all: async (...params) => {
        try {
          const authToken = getAuthToken();
          if (!authToken) {
            throw new Error('Not authenticated');
          }

          const flatParams = params.length > 0 && Array.isArray(params[0]) ? params[0] : params;
          
          // Parse SELECT * FROM table [WHERE col = ?] [ORDER BY col]
          const filter = {};
          const options = {};
          
          const whereMatch = sql.match(/WHERE\s+([^ORDER]+)/i);
          if (whereMatch) {
            const whereClause = whereMatch[1];
            const eqMatch = whereClause.match(/(\w+)\s*=\s*\?/);
            if (eqMatch && flatParams[0] !== undefined) {
              filter[eqMatch[1]] = flatParams[0];
            }
          }
          
          const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)\s+(ASC|DESC)?/i);
          if (orderMatch) {
            const sortField = orderMatch[1];
            const sortOrder = orderMatch[2]?.toUpperCase() === 'DESC' ? -1 : 1;
            options.sort = { [sortField]: sortOrder };
          } else {
            // Default sort by created_at DESC if no ORDER BY specified
            options.sort = { created_at: -1 };
          }

          const requestBody = {
            method: 'find',
            collection,
            filter,
            options,
          };

          const response = await fetchWithTimeout(API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${authToken}`,
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            let error;
            try {
              error = await response.json();
            } catch {
              error = { message: `HTTP ${response.status}` };
            }
            if (response.status === 504 || response.status === 408) {
              console.error('MongoDB: All timeout:', sql, params);
              return [];
            }
            throw new Error(error.message || 'Database operation failed');
          }

          const result = await response.json();
          return result.data || [];
        } catch (error) {
          if (error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
            console.error('MongoDB: All error (timeout/network):', error.message, sql, params);
            return [];
          }
          console.error('MongoDB: All error:', error, sql, params);
          return [];
        }
      },
    };
  }
}

let mongoDbWrapper = null;

export const initMongoDatabase = async () => {
  if (!isVercelDeployment()) {
    console.log('MongoDB: Not detected as Vercel deployment');
    return false;
  }

  console.log('MongoDB: Initializing MongoDB database wrapper');
  mongoDbWrapper = new MongoDatabaseWrapper();

  console.log('MongoDB: Wrapper created successfully');
  return true;
};

export const getMongoDatabase = () => {
  if (isVercelDeployment() && mongoDbWrapper) {
    return mongoDbWrapper;
  }
  return null;
};

