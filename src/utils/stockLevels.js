/**
 * Current sellable quantity for a product (stock_levels or summed inventory).
 */
export async function getCurrentProductStock(db, productId) {
  const pid = String(productId);
  let row = await db.prepare('SELECT quantity FROM stock_levels WHERE product_id = ?').get(pid);
  if (row == null && /^\d+$/.test(pid)) {
    row = await db.prepare('SELECT quantity FROM stock_levels WHERE product_id = ?').get(
      parseInt(pid, 10)
    );
  }
  if (row != null && row.quantity != null) {
    return parseInt(row.quantity, 10) || 0;
  }
  const txs = await db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').all(pid);
  const arr = Array.isArray(txs) ? txs : [];
  return arr.reduce((s, t) => s + (parseInt(t.quantity, 10) || 0), 0);
}
