import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiPlus, FiX } from 'react-icons/fi';
import './Sales.css';

const Sales = () => {
  const { db, isReady } = useDatabase();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    payment_method: 'Cash',
    notes: ''
  });

  useEffect(() => {
    if (isReady && db) {
      loadSales();
      loadProducts();
      loadCustomers();
    }
  }, [db, isReady]);

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

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.sale_price,
        discount: 0,
        tax: product.tax_rate || 0
      }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const updateCartItem = (productId, field, value) => {
    setCart(cart.map(item =>
      item.product_id === productId
        ? { ...item, [field]: parseFloat(value) || 0 }
        : item
    ));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    cart.forEach(item => {
      const itemSubtotal = item.quantity * item.unit_price;
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
      alert('Please add at least one product to the cart');
      return;
    }

    try {
      const { subtotal, totalDiscount, totalTax, finalAmount } = calculateTotals();
      
      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}`;

      // Insert sale
      const saleResult = await db.prepare(`
        INSERT INTO sales 
        (invoice_number, customer_id, total_amount, discount_amount, tax_amount, 
         final_amount, payment_method, payment_status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceNumber,
        formData.customer_id || null,
        subtotal,
        totalDiscount,
        totalTax,
        finalAmount,
        formData.payment_method,
        formData.payment_method === 'Cash' ? 'paid' : 'pending',
        formData.notes || null
      );

      const saleId = saleResult.lastInsertRowid;

      // Insert sale items
      for (const item of cart) {
        const itemSubtotal = item.quantity * item.unit_price;
        const itemDiscount = (itemSubtotal * item.discount) / 100;
        const itemAfterDiscount = itemSubtotal - itemDiscount;
        const itemTax = (itemAfterDiscount * item.tax) / 100;

        await db.prepare(`
          INSERT INTO sale_items 
          (sale_id, product_id, quantity, unit_price, discount, tax, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          saleId,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.discount,
          item.tax,
          itemSubtotal - itemDiscount + itemTax
        );

        // Update stock
        const currentStock = await db.prepare('SELECT quantity FROM stock_levels WHERE product_id = ?').get(item.product_id);
        if (currentStock) {
          await db.prepare(`
            UPDATE stock_levels 
            SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
            WHERE product_id = ?
          `).run(item.quantity, item.product_id);
        } else {
          // Initialize stock if doesn't exist
          await db.prepare(`
            INSERT INTO stock_levels (product_id, quantity, updated_at)
            VALUES (?, 0, CURRENT_TIMESTAMP)
          `).run(item.product_id);
        }

        // Add inventory transaction
        await db.prepare(`
          INSERT INTO inventory (product_id, transaction_type, quantity, notes)
          VALUES (?, 'OUT', ?, ?)
        `).run(item.product_id, item.quantity, `Sale - Invoice: ${invoiceNumber}`);
      }

      // Update customer outstanding balance if credit sale
      if (formData.customer_id && formData.payment_method !== 'Cash') {
        await db.prepare(`
          UPDATE customers 
          SET outstanding_balance = outstanding_balance + ?
          WHERE id = ?
        `).run(finalAmount, formData.customer_id);
      }

      await loadSales();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving sale:', error);
      alert('Error saving sale.');
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    // Reload products and customers when opening modal to ensure latest data
    loadProducts();
    loadCustomers();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCart([]);
    setFormData({
      customer_id: '',
      payment_method: 'Cash',
      notes: ''
    });
  };

  const { subtotal, totalDiscount, totalTax, finalAmount } = calculateTotals();

  const columns = [
    { key: 'invoice_number', label: 'Invoice #', width: '15%' },
    { key: 'customer_name', label: 'Customer', width: '20%' },
    { 
      key: 'sale_date', 
      label: 'Date', 
      width: '15%',
      render: (value) => new Date(value).toLocaleString()
    },
    { 
      key: 'final_amount', 
      label: 'Amount', 
      width: '15%',
      render: (value) => `Rs. ${parseFloat(value || 0).toLocaleString()}`
    },
    { key: 'payment_method', label: 'Payment Method', width: '15%' },
    { 
      key: 'payment_status', 
      label: 'Status', 
      width: '10%',
      render: (value) => (
        <span className={value === 'paid' ? 'status-paid' : 'status-pending'}>
          {value}
        </span>
      )
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
        <Table columns={columns} data={sales} />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="New Sale"
        size="large"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="input-label">Customer (Optional)</label>
              <select
                className="input"
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
              >
                <option value="">Walk-in Customer</option>
                {Array.isArray(customers) && customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="input-label">Payment Method</label>
              <select
                className="input"
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="JazzCash">JazzCash</option>
                <option value="EasyPaisa">EasyPaisa</option>
                <option value="Credit">Credit</option>
              </select>
            </div>
          </div>

          <div className="cart-section">
            <h4>Add Products</h4>
            <div className="product-grid">
              {Array.isArray(products) && products.map((product) => (
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
                      const itemTotal = item.quantity * item.unit_price * (1 - item.discount / 100) * (1 + item.tax / 100);
                      return (
                        <tr key={item.product_id}>
                          <td>{item.product_name}</td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateCartItem(item.product_id, 'quantity', e.target.value)}
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
                              onChange={(e) => updateCartItem(item.product_id, 'discount', e.target.value)}
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
              Complete Sale
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Sales;

