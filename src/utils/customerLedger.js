/** Customer account: acct_total − acct_paid = remaining (outstanding_balance). */

export function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

export function normalizeLedgerFromRow(cust) {
  if (!cust) return { total: 0, paid: 0, remaining: 0 };
  const O = Number(cust.outstanding_balance ?? cust.outstandingBalance ?? 0) || 0;
  const hasAcctFields =
    cust.acct_total != null ||
    cust.acctTotal != null ||
    cust.acct_paid != null ||
    cust.acctPaid != null;
  if (!hasAcctFields) {
    return { total: O, paid: 0, remaining: O };
  }
  let T = Number(cust.acct_total ?? cust.acctTotal ?? 0);
  let P = Number(cust.acct_paid ?? cust.acctPaid ?? 0);
  if (!Number.isFinite(T)) T = 0;
  if (!Number.isFinite(P)) P = 0;
  T = Math.max(0, T);
  P = Math.max(0, Math.min(T, P));
  /* Legacy rows: outstanding from sales but ledger never backfilled */
  if (T === 0 && P === 0 && Math.abs(O) > 0.005) {
    return { total: O, paid: 0, remaining: O };
  }
  return { total: T, paid: P, remaining: round2(T - P) };
}

export async function applyCreditFromSale(db, customerId, creditAmount) {
  const c = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!c) return;
  const { total, paid } = normalizeLedgerFromRow(c);
  const add = round2(Math.max(0, creditAmount));
  if (add <= 0) return;
  const newT = round2(total + add);
  const newP = paid;
  const newR = round2(newT - newP);
  await db
    .prepare(`
    UPDATE customers
    SET acct_total = ?, acct_paid = ?, outstanding_balance = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
    .run(newT, newP, newR, customerId);
}

export async function reverseCreditFromSale(db, customerId, creditAmount) {
  const c = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!c) return;
  const { total, paid } = normalizeLedgerFromRow(c);
  const sub = round2(Math.max(0, creditAmount));
  if (sub <= 0) return;
  const newT = Math.max(0, round2(total - sub));
  const newP = Math.max(0, Math.min(newT, paid));
  const newR = round2(newT - newP);
  await db
    .prepare(`
    UPDATE customers
    SET acct_total = ?, acct_paid = ?, outstanding_balance = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
    .run(newT, newP, newR, customerId);
}

/**
 * @param {'total'|'paid'|'remaining'} field
 * @param {'add'|'subtract'} direction
 */
export async function applyLedgerAdjustment(db, customerId, field, direction, amount, note) {
  const amt = round2(Math.max(0, Number(amount) || 0));
  if (amt <= 0) throw new Error('Enter an amount greater than 0.');
  const sign = direction === 'subtract' ? -1 : 1;

  const cust = await db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!cust) throw new Error('Customer not found.');

  let { total, paid } = normalizeLedgerFromRow(cust);

  if (field === 'total') {
    total = Math.max(0, round2(total + sign * amt));
    paid = Math.max(0, Math.min(total, paid));
  } else if (field === 'paid') {
    paid = Math.max(0, Math.min(total, round2(paid + sign * amt)));
  } else if (field === 'remaining') {
    if (sign > 0) {
      total = round2(total + amt);
    } else {
      paid = Math.max(0, Math.min(total, round2(paid + amt)));
    }
  } else {
    throw new Error('Invalid field.');
  }

  const remaining = round2(total - paid);

  await db
    .prepare(`
    UPDATE customers
    SET acct_total = ?, acct_paid = ?, outstanding_balance = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
    .run(total, paid, remaining, customerId);

  await db
    .prepare(`
    INSERT INTO customer_balance_history
    (customer_id, field_changed, direction, amount, total_after, paid_after, remaining_after, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .run(customerId, field, direction, amt, total, paid, remaining, note || null);

  return { total, paid, remaining };
}

export async function loadCustomerHistory(db, customerId) {
  const rows = await db
    .prepare(
      `
    SELECT * FROM customer_balance_history
    WHERE customer_id = ?
    ORDER BY entry_date DESC
  `
    )
    .all(customerId);
  return Array.isArray(rows) ? rows : [];
}
