// Helper functions to make database operations easier
export const dbQuery = async (db, sql, params = []) => {
  if (!db) return null;
  const stmt = db.prepare(sql);
  return await stmt.get(...params);
};

export const dbQueryAll = async (db, sql, params = []) => {
  if (!db) return [];
  const stmt = db.prepare(sql);
  return await stmt.all(...params);
};

export const dbExecute = async (db, sql, params = []) => {
  if (!db) return { lastInsertRowid: 1, changes: 0 };
  const stmt = db.prepare(sql);
  return await stmt.run(...params);
};

