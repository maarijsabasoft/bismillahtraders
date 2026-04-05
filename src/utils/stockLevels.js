import { sumInventorySignedQuantity } from './inventoryStock';

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
  const txs = await db
    .prepare('SELECT quantity, transaction_type FROM inventory WHERE product_id = ?')
    .all(pid);
  return sumInventorySignedQuantity(Array.isArray(txs) ? txs : []);
}
