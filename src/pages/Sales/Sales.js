import React, { useState, useEffect, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useListCache } from '../../context/ListCacheContext';
import { LIST_CACHE_KEYS } from '../../context/listCacheKeys';
import { useToast } from '../../context/ToastContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiPlus, FiX, FiTrash2 } from 'react-icons/fi';
import { getCurrentProductStock } from '../../utils/stockLevels';
import { deleteSaleById } from '../../utils/saleDelete';
import './Sales.css';

const Sales = () => {
  const { db, isReady, dataRevision } = useDatabase();
  const { readListCache, writeListCache } = useListCache();
  const { toastError, toastSuccess } = useToast();
  const [sales, setSales] = useState(() => readListCache(LIST_CACHE_KEYS.salesRows) ?? []);
  const [products, setProducts] = useState(
    () => readListCache(LIST_CACHE_KEYS.salesProducts) ?? []
  );
  const [customers, setCustomers] = useState(
    () => readListCache(LIST_CACHE_KEYS.salesCustomers) ?? []
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    cash_paid: '',
    bank_paid: '',
    bank_account_label: '',
    notes: '',
  });

  useEffect(() => {
    if (isReady && db) {
      loadSales();
      loadProducts();
      loadCustomers();
    }
  }, [db, isReady, dataRevision]);

  useEffect(() => {
    writeListCache(LIST_CACHE_KEYS.salesRows, sales);
  }, [sales, writeListCache]);

  useEffect(() => {
    writeListCache(LIST_CACHE_KEYS.salesProducts, products);
  }, [products, writeListCache]);

  useEffect(() => {
    writeListCache(LIST_CACHE_KEYS.salesCustomers, customers);
  }, [customers, writeListCache]);

  const loadProducts = async () => {
    try {
      const result = await db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY name').all();
      setProducts(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    }
  };

  const loadCustomers = async () => {
    try {
      const result = await db.prepare('SELECT * FROM customers ORDER BY name').all();
      setCustomers(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
    }
  };

  const loadSales = async () => {
    try {
      const result = await db.prepare(`
        SELECT s.*, c.name as customer_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        ORDER BY s.sale_date DESC
        LIMIT 100
      `).all();
      setSales(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading sales:', error);
      setSales([]);
    }
  };

  const selectedCustomer = useMemo(() => {
    if (!formData.customer_id) return null;
    return customers.find((c) => String(c.id) === String(formData.customer_id)) || null;
  }, [formData.customer_id, customers]);

  const addToCart = (product) => {
    const existingItem = cart.find((item) => item.product_id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.sale_price,
          discount: 0,
          tax: product.tax_rate || 0,
        },
      ]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const updateCartItem = (productId, field, value) => {
    setCart(
      cart.map((item) =>
        item.product_id === productId ? { ...item, [field]: parseFloat(value) || 0 } : item
      )
    );
  };

  const lineQtyOf = (item) => Math.max(0, parseInt(item.quantity, 10) || 0);

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    cart.forEach((item) => {
      const q = lineQtyOf(item);
      if (q < 1) return;
      const itemSubtotal = q * item.unit_price;
      const itemDiscount = (itemSubtotal * item.discount) / 100;
      const itemAfterDiscount = itemSubtotal - itemDiscount;
      const itemTax = (itemAfterDiscount * item.tax) / 100;

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
    });

    const finalAmount = subtotal - totalDiscount + totalTax;

    return { subtotal, totalDiscount, totalTax, finalAmount };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      toastError('Please add at least one product to the cart.');
      return;
    }

    if (!cart.some((item) => lineQtyOf(item) >= 1)) {
      toastError('Set quantity to at least 1 for each product you want to sell.');
      return;
    }

    try {
      const { subtotal, totalDiscount, totalTax, finalAmount } = calculateTotals();
      const cashAmt = Math.max(0, parseFloat(formData.cash_paid) || 0);
      const bankAmt = Math.max(0, parseFloat(formData.bank_paid) || 0);
      const paid = Math.round((cashAmt + bankAmt) * 100) / 100;
      const creditPortion = Math.max(0, Math.round((finalAmount - paid) * 100) / 100);

      if (paid > finalAmount + 0.01) {
        toastError('Cash + bank payments cannot exceed the invoice total.');
        return;
      }

      for (const item of cart) {
        const q = lineQtyOf(item);
        if (q < 1) {
          toastError(`Quantity must be at least 1 for "${item.product_name}".`);
          return;
        }
        const avail = await getCurrentProductStock(db, item.product_id);
        if (avail < q) {
          toastError(
            `Not enough stock for "${item.product_name}". Available: ${avail}, needed: ${q}.`
          );
          return;
        }
      }

      let payment_status = 'paid';
      if (creditPortion > 0.005) {
        payment_status = paid > 0.005 ? 'partial' : 'pending';
      }

      const bankLabel = (formData.bank_account_label || '').trim();
      let payment_method = 'Cash';
      if (cashAmt > 0.005 && bankAmt > 0.005) {
        payment_method = `Mixed (Cash + ${bankLabel || 'Account'})`;
      } else if (bankAmt > 0.005) {
        payment_method = bankLabel || 'Bank / Wallet';
      } else {
        payment_method = 'Cash';
      }

      const invoiceNumber = `INV-${Date.now()}`;

      const saleResult = await db
        .prepare(`
        INSERT INTO sales 
        (invoice_number, customer_id, total_amount, discount_amount, tax_amount, 
         final_amount, payment_method, payment_status, notes, cash_amount, bank_amount, bank_account_label)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(
          invoiceNumber,
          formData.customer_id || null,
          subtotal,
          totalDiscount,
          totalTax,
          finalAmount,
          payment_method,
          payment_status,
          formData.notes || null,
          cashAmt,
          bankAmt,
          bankLabel || null
        );

      const saleId = saleResult.lastInsertRowid;

      for (const item of cart) {
        const lineQty = lineQtyOf(item);
        if (lineQty < 1) continue;

        const itemSubtotal = lineQty * item.unit_price;
        const itemDiscount = (itemSubtotal * item.discount) / 100;
        const itemAfterDiscount = itemSubtotal - itemDiscount;
        const itemTax = (itemAfterDiscount * item.tax) / 100;

        await db
          .prepare(`
          INSERT INTO sale_items 
          (sale_id, product_id, quantity, unit_price, discount, tax, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
          .run(
            saleId,
            item.product_id,
            lineQty,
            item.unit_price,
            item.discount,
            item.tax,
            itemSubtotal - itemDiscount + itemTax
          );

        const qtyAvail = await getCurrentProductStock(db, item.product_id);
        const nextQty = qtyAvail - lineQty;

        let existing = await db.prepare('SELECT * FROM stock_levels WHERE product_id = ?').get(item.product_id);
        if (!existing && /^\d+$/.test(String(item.product_id))) {
          existing = await db
            .prepare('SELECT * FROM stock_levels WHERE product_id = ?')
            .get(parseInt(String(item.product_id), 10));
        }

        const stockPid = existing?.product_id != null ? existing.product_id : item.product_id;

        if (existing) {
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
            .run(item.product_id, nextQty);
        }

        await db
          .prepare(`
          INSERT INTO inventory (product_id, transaction_type, quantity, notes)
          VALUES (?, 'OUT', ?, ?)
        `)
          .run(stockPid, lineQty, `Sale - Invoice: ${invoiceNumber}`);
      }

      if (formData.customer_id && creditPortion > 0.005) {
        await db
          .prepare(`
          UPDATE customers 
          SET outstanding_balance = COALESCE(outstanding_balance, 0) + ?
          WHERE id = ?
        `)
          .run(creditPortion, formData.customer_id);
      }

      await loadSales();
      handleCloseModal();
      toastSuccess(`Sale saved — ${invoiceNumber}. Stock updated.`);
    } catch (error) {
      console.error('Error saving sale:', error);
      toastError(error?.message || 'Could not save sale. Check connection and try again.');
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    loadProducts();
    loadCustomers();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCart([]);
    setFormData({
      customer_id: '',
      cash_paid: '',
      bank_paid: '',
      bank_account_label: '',
      notes: '',
    });
  };

  const handleDeleteSale = async (row) => {
    const inv = row.invoice_number || row.id;
    if (
      !window.confirm(
        `Delete sale ${inv}? Stock will be restored and any unpaid balance for this invoice will be removed from the customer.`
      )
    ) {
      return;
    }
    try {
      await deleteSaleById(db, row.id);
      await loadSales();
      toastSuccess(`Sale ${inv} deleted.`);
    } catch (error) {
      console.error('Error deleting sale:', error);
      toastError(error?.message || 'Could not delete sale.');
    }
  };

  const { subtotal, totalDiscount, totalTax, finalAmount } = calculateTotals();
  const cashAmt = Math.max(0, parseFloat(formData.cash_paid) || 0);
  const bankAmt = Math.max(0, parseFloat(formData.bank_paid) || 0);
  const paidShown = Math.round((cashAmt + bankAmt) * 100) / 100;
  const dueShown = Math.max(0, Math.round((finalAmount - paidShown) * 100) / 100);

  const columns = [
    { key: 'invoice_number', label: 'Invoice #', width: '15%' },
    { key: 'customer_name', label: 'Customer', width: '20%' },
    {
      key: 'sale_date',
      label: 'Date',
      width: '15%',
      render: (value) => new Date(value).toLocaleString(),
    },
    {
      key: 'final_amount',
      label: 'Amount',
      width: '15%',
      render: (value) => `Rs. ${parseFloat(value || 0).toLocaleString()}`,
    },
    { key: 'payment_method', label: 'Payment', width: '15%' },
    {
      key: 'payment_status',
      label: 'Status',
      width: '10%',
      render: (value) => (
        <span
          className={
            value === 'paid' ? 'status-paid' : value === 'partial' ? 'status-partial' : 'status-pending'
          }
        >
          {value}
        </span>
      ),
    },
  ];

  return (
    <div className="sales-page">
      <div className="page-header">
        <h1 className="page-title">Sales</h1>
        <Button onClick={handleOpenModal}>
          <FiPlus /> New Sale
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          data={sales}
          actions={(row) => (
            <Button
              variant="danger"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSale(row);
              }}
              title="Delete sale"
            >
              <FiTrash2 />
            </Button>
          )}
        />
      </Card>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="New Sale" size="large">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="input-label">Customer (optional)</label>
              <select
                className="input"
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
              >
                <option value="">Walk-in customer</option>
                {Array.isArray(customers) &&
                  customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              {selectedCustomer && (
                <div className="sales-customer-balance">
                  <strong>Account balance (due):</strong>{' '}
                  Rs. {parseFloat(selectedCustomer.outstanding_balance || 0).toLocaleString()}
                  {selectedCustomer.credit_limit != null && (
                    <span className="sales-credit-limit">
                      {' '}
                      · Credit limit Rs. {parseFloat(selectedCustomer.credit_limit || 0).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="cart-section">
            <h4>Add products</h4>
            <div className="product-grid">
              {Array.isArray(products) &&
                products.map((product) => (
                  <div key={product.id} className="product-card" onClick={() => addToCart(product)}>
                    <div className="product-name">{product.name}</div>
                    <div className="product-price">Rs. {product.sale_price}</div>
                  </div>
                ))}
            </div>
          </div>

          {cart.length > 0 && (
            <div className="cart-section">
              <h4>Cart</h4>
              <div className="cart-table">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Discount %</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => {
                      const itemTotal =
                        item.quantity *
                        item.unit_price *
                        (1 - item.discount / 100) *
                        (1 + item.tax / 100);
                      return (
                        <tr key={item.product_id}>
                          <td>{item.product_name}</td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updateCartItem(item.product_id, 'quantity', e.target.value)
                              }
                              className="cart-input"
                            />
                          </td>
                          <td>{item.unit_price}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount}
                              onChange={(e) =>
                                updateCartItem(item.product_id, 'discount', e.target.value)
                              }
                              className="cart-input"
                            />
                          </td>
                          <td>Rs. {itemTotal.toFixed(2)}</td>
                          <td>
                            <Button
                              variant="danger"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromCart(item.product_id);
                              }}
                            >
                              <FiX />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="cart-totals">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>Rs. {subtotal.toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Discount:</span>
                  <span>- Rs. {totalDiscount.toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Tax:</span>
                  <span>Rs. {totalTax.toFixed(2)}</span>
                </div>
                <div className="total-row total-final">
                  <span>Total:</span>
                  <span>Rs. {finalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="sales-payment-split">
                <h4>Payment split</h4>
                <p className="sales-payment-hint">
                  Enter cash and/or bank wallet amounts. Any unpaid total is added to the customer&apos;s
                  balance (if a customer is selected).
                </p>
                <div className="form-row">
                  <Input
                    label="Cash (Rs)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.cash_paid}
                    onChange={(e) => setFormData({ ...formData, cash_paid: e.target.value })}
                    placeholder="0"
                  />
                  <Input
                    label="Bank / wallet (Rs)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.bank_paid}
                    onChange={(e) => setFormData({ ...formData, bank_paid: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <Input
                  label="Account label (e.g. JazzCash, HBL)"
                  value={formData.bank_account_label}
                  onChange={(e) => setFormData({ ...formData, bank_account_label: e.target.value })}
                  placeholder="Optional — shown on invoice"
                />
                <div className="sales-payment-summary">
                  <span>Paid now: Rs. {paidShown.toFixed(2)}</span>
                  <span className={dueShown > 0.005 ? 'sales-due' : ''}>
                    {dueShown > 0.005
                      ? `On account: Rs. ${dueShown.toFixed(2)}`
                      : 'Fully paid'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Input
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Optional notes"
          />

          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={cart.length === 0}>
              Complete sale
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Sales;
