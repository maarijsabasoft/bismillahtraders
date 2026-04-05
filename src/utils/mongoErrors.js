/**
 * User-facing messages for Mongo / API failures from CRUD screens.
 */

export function mongoCrudErrorMessage(error, dbMode, { duplicateHint } = {}) {
  const msg = error && error.message ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (
    lower.includes('e11000') ||
    lower.includes('duplicate') ||
    lower.includes('unique') ||
    lower.includes('constraint failed')
  ) {
    return duplicateHint || 'This value already exists. Change it and try again.';
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('not authenticated')) {
    return 'Sign in again, and ensure REACT_APP_ADMIN_* matches ADMIN_* on the server (Vercel env).';
  }
  if (
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('failed to fetch') ||
    lower.includes('unexpected token') ||
    lower.includes('mongodb api not found')
  ) {
    if (dbMode === 'mongodb') {
      return 'Mongo API is not reachable at /api/db/mongodb. On localhost run: npm run dev:vercel — or set DEV_API_PROXY to your API URL.';
    }
    return 'Could not reach the database API. Check your network and dev setup.';
  }
  if (lower.includes('ssl') || lower.includes('tls') || lower.includes('alert number 80')) {
    return 'Secure connection to the database failed. Refresh and try again. If it persists, check Vercel MONGODB_URI and Atlas Network Access.';
  }
  if (lower.includes('timeout') || lower.includes('504') || lower.includes('invocation_timeout')) {
    return 'The database took too long to respond. Try again; upgrade Vercel plan or check Atlas region if this keeps happening.';
  }
  if (lower.includes('empty insert') || lower.includes('parse failed')) {
    return `Database client error: ${msg}`;
  }
  return msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;
}
