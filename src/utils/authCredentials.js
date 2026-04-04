/**
 * Must match api/db/auth.js (ADMIN_USERNAME / ADMIN_PASSWORD) on the server.
 * Use REACT_APP_* in .env / Vercel so login + Mongo API Basic auth stay in sync.
 */
export function getAdminUsername() {
  return process.env.REACT_APP_ADMIN_USERNAME || 'admin';
}

export function getAdminPassword() {
  return process.env.REACT_APP_ADMIN_PASSWORD || 'admin123';
}
