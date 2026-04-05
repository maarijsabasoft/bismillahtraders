/**
 * Remove a product and its stock / inventory rows (SQLite + Mongo SQL wrapper).
 * Historical sale_items rows are left as-is (FK not enforced in browser SQLite without PRAGMA).
 */
export async function deleteProductCascade(db, productId) {
  const id = productId;
  if (id == null || id === '') {
    throw new Error('Invalid product id');
  }
  await db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
  await db.prepare('DELETE FROM stock_levels WHERE product_id = ?').run(id);
  await db.prepare('DELETE FROM products WHERE id = ?').run(id);
}
