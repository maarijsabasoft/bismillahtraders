// Database wrapper for MongoDB Atlas
// Fast, reliable, no timeouts - perfect for web applications

// Get API URL
function getApiUrl() {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  return '/api/db/mongodb';
}

const API_BASE_URL = getApiUrl();
const FETCH_TIMEOUT = 30000; // 30 seconds

// Fetch with timeout helper
async function fetchWithTimeout(url, options, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
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
    const username = process.env.REACT_APP_ADMIN_USERNAME || 'admin';
    const password = process.env.REACT_APP_ADMIN_PASSWORD || 'admin123';
    return btoa(`${username}:${password}`);
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
            // Parse INSERT INTO table (col1, col2) VALUES (?, ?)
            const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
            const columnsMatch = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
            
            if (columnsMatch && valuesMatch) {
              const columns = columnsMatch[1].split(',').map(c => c.trim());
              const values = flatParams;
              
              columns.forEach((col, idx) => {
                if (values[idx] !== undefined) {
                  data[col] = values[idx];
                }
              });
            }
          } else if (upperSQL.startsWith('UPDATE')) {
            method = 'updateOne';
            // Parse UPDATE table SET col1 = ?, col2 = ? WHERE id = ?
            const setMatch = sql.match(/SET\s+([^WHERE]+)/i);
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
            
            if (setMatch) {
              const setClause = setMatch[1];
              const assignments = setClause.split(',').map(a => a.trim());
              
              let paramIndex = 0;
              assignments.forEach(assign => {
                const [col] = assign.split('=').map(s => s.trim());
                if (flatParams[paramIndex] !== undefined) {
                  data[col] = flatParams[paramIndex];
                  paramIndex++;
                }
              });
              
              // Handle WHERE clause
              if (whereMatch && flatParams[paramIndex] !== undefined) {
                filter[whereMatch[1]] = flatParams[paramIndex];
              }
            }
          } else if (upperSQL.startsWith('DELETE')) {
            method = 'deleteOne';
            // Parse DELETE FROM table WHERE id = ?
            const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
            if (whereMatch && flatParams[0] !== undefined) {
              filter[whereMatch[1]] = flatParams[0];
            }
          } else {
            throw new Error(`Unsupported SQL operation: ${sql.substring(0, 20)}...`);
          }

          const requestBody = {
            method,
            collection,
            filter,
            data,
          };

          console.log('MongoDB: Making request', requestBody);

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
            throw new Error(error.message || error.error || 'Database operation failed');
          }

          const result = await response.json();
          console.log('MongoDB: Operation successful', result);
          return result.data;
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
            options.sort = { [orderMatch[1]]: orderMatch[2]?.toUpperCase() === 'DESC' ? -1 : 1 };
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

