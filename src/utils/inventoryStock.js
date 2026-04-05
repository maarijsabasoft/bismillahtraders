/**
 * Net change from one inventory row. OUT always reduces stock (sales use positive qty + type OUT;
 * manual OUT may use negative qty in DB — both normalize to a negative delta).
 */
export function inventoryQuantitySignedDelta(row) {
  const raw = parseInt(row?.quantity, 10) || 0;
  const type = String(row?.transaction_type ?? row?.transactionType ?? '').toUpperCase();
  if (type === 'OUT') {
    return -Math.abs(raw);
  }
  return Math.abs(raw);
}

export function sumInventorySignedQuantity(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + inventoryQuantitySignedDelta(row), 0);
}
