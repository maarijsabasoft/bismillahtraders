// Database wrapper for Vercel deployment
// Uses API routes instead of direct SQLite

// Get API URL - supports both relative (Vercel) and absolute (Electron) URLs
function getApiUrl() {
  // If custom API URL is set, use it (for Electron)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // For Vercel web deployment, use relative URL
  // For Electron, this won't work - need to set REACT_APP_API_URL
  return '/api/db/query';
}

const API_BASE_URL = getApiUrl();

// Get auth token from localStorage
function getAuthToken() {
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  if (isAuthenticated === 'true') {
    // Get credentials from environment or use defaults
    // In production, these should match Vercel environment variables
    const username = process.env.REACT_APP_ADMIN_USERNAME || 'admin';
    const password = process.env.REACT_APP_ADMIN_PASSWORD || 'admin123';
    return btoa(`${username}:${password}`);
  }
  return null;
}

// Check if we're on Vercel (production)
function isVercelDeployment() {
  if (typeof window === 'undefined') return false;
  
  // Check environment variable first (most reliable)
  if (process.env.REACT_APP_USE_VERCEL_DB === 'true') {
    return true;
  }
  
  // Check hostname
  if (process.env.NODE_ENV === 'production') {
    return window.location.hostname.includes('vercel.app') || 
           window.location.hostname.includes('vercel.com');
  }
  
  return false;
}

// Database wrapper with better-sqlite3-like API for Vercel
class VercelDatabaseWrapper {
  async prepare(sql) {
    return {
      run: async (...params) => {
        try {
          const authToken = getAuthToken();
          if (!authToken) {
            throw new Error('Not authenticated');
          }

          const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${authToken}`,
            },
            body: JSON.stringify({
              method: 'run',
              sql,
              params: params.length > 0 && Array.isArray(params[0]) ? params[0] : params,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Database operation failed');
          }

          const result = await response.json();
          return result.data;
        } catch (error) {
          console.error('Database run error:', error, sql, params);
          throw error;
        }
      },
      get: async (...params) => {
        try {
          const authToken = getAuthToken();
          if (!authToken) {
            throw new Error('Not authenticated');
          }

          const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${authToken}`,
            },
            body: JSON.stringify({
              method: 'get',
              sql,
              params: params.length > 0 && Array.isArray(params[0]) ? params[0] : params,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Database operation failed');
          }

          const result = await response.json();
          return result.data;
        } catch (error) {
          console.error('Database get error:', error, sql, params);
          return null;
        }
      },
      all: async (...params) => {
        try {
          const authToken = getAuthToken();
          if (!authToken) {
            throw new Error('Not authenticated');
          }

          const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${authToken}`,
            },
            body: JSON.stringify({
              method: 'all',
              sql,
              params: params.length > 0 && Array.isArray(params[0]) ? params[0] : params,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Database operation failed');
          }

          const result = await response.json();
          return result.data || [];
        } catch (error) {
          console.error('Database all error:', error, sql, params);
          return [];
        }
      },
    };
  }
}

let vercelDbWrapper = null;

export const initVercelDatabase = async () => {
  if (isVercelDeployment()) {
    vercelDbWrapper = new VercelDatabaseWrapper();
    return true;
  }
  return false;
};

export const getVercelDatabase = () => {
  if (isVercelDeployment() && vercelDbWrapper) {
    return vercelDbWrapper;
  }
  return null;
};

