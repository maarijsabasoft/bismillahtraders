import { getCurrentProductStock } from './stockLevels';
import { reverseCreditFromSale } from './customerLedger';

function filterRowsBySaleId(rows, saleId) {
  const sid = String(saleId);
  return (Array.isArray(rows) ? rows : []).filter(
    (r) => String(r.sale_id ?? r.saleId ?? '') === sid
  );
}

/**
 * Delete a sale (and its line items): restores stock, reverses customer credit, removes DB rows.
 * Works with local SQLite and Mongo API wrapper.
 */
export async function deleteSaleById(db, saleId) {
  const sid = saleId != null ? saleId : null;
  if (sid === null || sid === '') {
    throw new Error('Invalid sale id');
  }

  const sale = await db.prepare('SELECT * FROM sales WHERE id = ?').get(sid);
  if (!sale) {
    throw new Error('Sale not found');
  }

  const rawItems = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sid);
  const items = filterRowsBySaleId(rawItems, sid);

  for (const line of items) {
    const qty = parseInt(line.quantity, 10) || 0;
    if (qty <= 0) continue;
    const pid = line.product_id;

    const qtyAvail = await getCurrentProductStock(db, pid);
    const nextQty = qtyAvail + qty;

    let existing = await db.prepare('SELECT * FROM stock_levels WHERE product_id = ?').get(pid);
    if (!existing && /^\d+$/.test(String(pid))) {
      existing = await db
        .prepare('SELECT * FROM stock_levels WHERE product_id = ?')
        .get(parseInt(String(pid), 10));
    }

    if (existing) {
      const stockPid = existing.product_id != null ? existing.product_id : pid;
      await db
        .prepare(`
          UPDATE stock_levels
          SET quantity = ?, updated_at = CURRENT_TIMESTAMP
          WHERE product_id = ?
        `)
        .run(nextQty, stockPid);
    } else {
      await db
        .prepare(`
          INSERT INTO stock_levels (product_id, quantity, low_stock_threshold, updated_at)
          VALUES (?, ?, 10, CURRENT_TIMESTAMP)
        `)
        .run(pid, nextQty);
    }

    const invNote = `Sale deleted — stock restored (${sale.invoice_number || sid})`;
    await db
      .prepare(`
        INSERT INTO inventory (product_id, transaction_type, quantity, notes)
        VALUES (?, 'IN', ?, ?)
      `)
      .run(pid, qty, invNote);
  }

  const finalAmount = Number(sale.final_amount ?? sale.finalAmount ?? 0) || 0;
  const cashAmt = Number(sale.cash_amount ?? sale.cashAmount ?? 0) || 0;
  const bankAmt = Number(sale.bank_amount ?? sale.bankAmount ?? 0) || 0;
  const creditBack = Math.max(0, Math.round((finalAmount - cashAmt - bankAmt) * 100) / 100);

  const customerId = sale.customer_id ?? sale.customerId ?? null;
  if (creditBack > 0.005 && customerId) {
    await reverseCreditFromSale(db, customerId, creditBack);
  }

  await db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(sid);
  await db.prepare('DELETE FROM sales WHERE id = ?').run(sid);
}
