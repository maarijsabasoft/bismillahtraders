// Database wrapper for Vercel Postgres
// Fast, reliable, no timeouts - perfect for web applications

// Get API URL
function getApiUrl() {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  return '/api/db/postgres';
}

const API_BASE_URL = getApiUrl();
const FETCH_TIMEOUT = 30000; // 30 seconds (Postgres is much faster)

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

  if (process.env.REACT_APP_USE_POSTGRES === 'true') {
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

// Convert SQLite SQL to Postgres SQL
function convertSQLiteToPostgres(sql, params) {
  let convertedSQL = sql.trim();

  // Replace SQLite-specific syntax with Postgres
  // DATETIME -> TIMESTAMP
  convertedSQL = convertedSQL.replace(/DATETIME/g, 'TIMESTAMP');
  
  // Replace date() function calls - Postgres uses DATE() or ::date cast
  convertedSQL = convertedSQL.replace(/date\(([^)]+)\)/gi, 'DATE($1)');
  
  // Handle date comparisons - convert date(column) = date(?) to DATE(column) = $1
  // This is already handled by the date() replacement above

  // Count question marks to validate parameter count
  const questionMarkCount = (convertedSQL.match(/\?/g) || []).length;
  const paramCount = params ? params.length : 0;

  if (questionMarkCount !== paramCount) {
    console.warn(`Parameter count mismatch: ${questionMarkCount} placeholders, ${paramCount} params`);
  }

  // Replace ? placeholders with $1, $2, etc. for Postgres
  if (params && params.length > 0) {
    let paramIndex = 1;
    convertedSQL = convertedSQL.replace(/\?/g, () => {
      const placeholder = `$${paramIndex}`;
      paramIndex++;
      return placeholder;
    });
  }

  // Handle INSERT statements - add RETURNING id if not present
  if (convertedSQL.toUpperCase().startsWith('INSERT')) {
    if (!convertedSQL.toUpperCase().includes('RETURNING')) {
      // Remove trailing semicolon if present
      convertedSQL = convertedSQL.replace(/;?\s*$/, '');
      convertedSQL = convertedSQL + ' RETURNING id';
    }
  }

  // Remove last_insert_rowid() calls - not needed with RETURNING
  // These are typically in separate queries, so we'll handle them differently
  if (convertedSQL.includes('last_insert_rowid')) {
    console.warn('last_insert_rowid() detected - use RETURNING id in INSERT instead');
  }

  return convertedSQL;
}

// Database wrapper with better-sqlite3-like API for Postgres
class PostgresDatabaseWrapper {
  prepare(sql) {
    return {
      run: async (...params) => {
        try {
          const authToken = getAuthToken();
          if (!authToken) {
            console.error('Postgres DB: Not authenticated - user must login first');
            throw new Error('Not authenticated. Please login.');
          }

          const flatParams = params.length > 0 && Array.isArray(params[0]) ? params[0] : params;
          const convertedSQL = convertSQLiteToPostgres(sql, flatParams);

          const requestBody = {
            method: 'run',
            query: convertedSQL,
            params: flatParams,
          };

          console.log('Postgres DB: Making request to', API_BASE_URL, requestBody);

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
            console.error('Postgres DB: API error', response.status, error);

            if (response.status === 504 || response.status === 408) {
              throw new Error(
                'Database operation timed out. Please try again or contact support.'
              );
            }

            throw new Error(error.message || error.error || 'Database operation failed');
          }

          const result = await response.json();
          console.log('Postgres DB: Operation successful', result);
          return result.data;
        } catch (error) {
          console.error('Postgres DB: Database run error:', error.message, sql);
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
          const convertedSQL = convertSQLiteToPostgres(sql, flatParams);

          const response = await fetchWithTimeout(API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${authToken}`,
            },
            body: JSON.stringify({
              method: 'get',
              query: convertedSQL,
              params: flatParams,
            }),
          });

          if (!response.ok) {
            let error;
            try {
              error = await response.json();
            } catch {
              error = { message: `HTTP ${response.status}` };
            }

            if (response.status === 504 || response.status === 408) {
              console.error('Postgres DB: Get timeout:', sql, params);
              return null;
            }

            throw new Error(error.message || 'Database operation failed');
          }

          const result = await response.json();
          return result.data;
        } catch (error) {
          if (
            error.message.includes('timeout') ||
            error.message.includes('Failed to fetch')
          ) {
            console.error('Postgres DB: Get error (timeout/network):', error.message, sql, params);
            return null;
          }
          console.error('Postgres DB: Get error:', error, sql, params);
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
          const convertedSQL = convertSQLiteToPostgres(sql, flatParams);

          const response = await fetchWithTimeout(API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${authToken}`,
            },
            body: JSON.stringify({
              method: 'all',
              query: convertedSQL,
              params: flatParams,
            }),
          });

          if (!response.ok) {
            let error;
            try {
              error = await response.json();
            } catch {
              error = { message: `HTTP ${response.status}` };
            }

            if (response.status === 504 || response.status === 408) {
              console.error('Postgres DB: All timeout:', sql, params);
              return [];
            }

            throw new Error(error.message || 'Database operation failed');
          }

          const result = await response.json();
          return result.data || [];
        } catch (error) {
          if (
            error.message.includes('timeout') ||
            error.message.includes('Failed to fetch')
          ) {
            console.error(
              'Postgres DB: All error (timeout/network):',
              error.message,
              sql,
              params
            );
            return [];
          }
          console.error('Postgres DB: All error:', error, sql, params);
          return [];
        }
      },
    };
  }
}

let postgresDbWrapper = null;

export const initPostgresDatabase = async () => {
  if (!isVercelDeployment()) {
    console.log('Postgres DB: Not detected as Vercel deployment');
    return false;
  }

  console.log('Postgres DB: Initializing Postgres database wrapper');
  postgresDbWrapper = new PostgresDatabaseWrapper();

  // Test connection by trying to setup tables (idempotent)
  try {
    const authToken = getAuthToken();
    if (authToken) {
      const setupUrl = API_BASE_URL.replace('/postgres', '/setup');
      const response = await fetchWithTimeout(
        setupUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${authToken}`,
          },
        },
        10000
      );

      if (response.ok) {
        console.log('Postgres DB: Database tables verified/created');
      }
    }
  } catch (error) {
    console.log('Postgres DB: Setup check failed (may need manual setup):', error.message);
  }

  console.log('Postgres DB: Wrapper created successfully');
  return true;
};

export const getPostgresDatabase = () => {
  if (isVercelDeployment() && postgresDbWrapper) {
    return postgresDbWrapper;
  }
  return null;
};

