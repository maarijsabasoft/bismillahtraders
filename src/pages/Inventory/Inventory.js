import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiPlus } from 'react-icons/fi';
import './Inventory.css';

const Inventory = () => {
  const { db, isReady } = useDatabase();
  const [stockLevels, setStockLevels] = useState([]);
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    transaction_type: 'IN',
    quantity: '',
    batch_number: '',
    expiry_date: '',
    notes: ''
  });

  useEffect(() => {
    if (isReady && db) {
      loadStockLevels();
      loadProducts();
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

  const loadStockLevels = async () => {
    try {
      // Get all products with their stock levels
      const products = await db.prepare(`
        SELECT p.id, p.name as product_name, c.name as company_name,
               COALESCE(sl.quantity, 0) as current_stock,
               COALESCE(sl.low_stock_threshold, 10) as low_stock_threshold,
               sl.updated_at
        FROM products p
        LEFT JOIN companies c ON CAST(p.company_id AS INTEGER) = CAST(c.id AS INTEGER)
        LEFT JOIN stock_levels sl ON CAST(p.id AS INTEGER) = CAST(sl.product_id AS INTEGER)
        WHERE p.is_active = 1
        ORDER BY p.name
      `).all();
      setStockLevels(Array.isArray(products) ? products : []);
    } catch (error) {
      console.error('Error loading stock levels:', error);
      setStockLevels([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product_id || !formData.quantity) return;

    try {
      const quantity = parseInt(formData.quantity);
      if (quantity <= 0) {
        alert('Quantity must be greater than 0');
        return;
      }

      // Insert inventory transaction
      await db.prepare(`
        INSERT INTO inventory 
        (product_id, transaction_type, quantity, batch_number, expiry_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        formData.product_id,
        formData.transaction_type,
        formData.transaction_type === 'IN' ? quantity : -quantity,
        formData.batch_number || null,
        formData.expiry_date || null,
        formData.notes || null
      );

      // Update stock level
      const currentStock = await db.prepare('SELECT quantity FROM stock_levels WHERE product_id = ?').get(formData.product_id);
      const newQuantity = (currentStock ? currentStock.quantity : 0) + (formData.transaction_type === 'IN' ? quantity : -quantity);
      
      if (currentStock) {
        await db.prepare(`
          UPDATE stock_levels 
          SET quantity = ?, updated_at = CURRENT_TIMESTAMP
          WHERE product_id = ?
        `).run(newQuantity, formData.product_id);
      } else {
        await db.prepare(`
          INSERT INTO stock_levels (product_id, quantity, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(formData.product_id, newQuantity);
      }

      // Reload stock levels after successful operation
      await loadStockLevels();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving inventory:', error);
      alert('Error saving inventory transaction.');
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    // Reload products when opening modal to ensure latest data
    loadProducts();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      product_id: '',
      transaction_type: 'IN',
      quantity: '',
      batch_number: '',
      expiry_date: '',
      notes: ''
    });
  };

  const columns = [
    { 
      key: 'company_name', 
      label: 'Company', 
      width: '20%',
      render: (value) => value || 'N/A'
    },
    { 
      key: 'product_name', 
      label: 'Product', 
      width: '25%',
      render: (value) => value || 'N/A'
    },
    { 
      key: 'current_stock', 
      label: 'Current Stock', 
      width: '15%',
      render: (value) => value || 0
    },
    { 
      key: 'low_stock_threshold', 
      label: 'Low Stock Alert', 
      width: '15%',
      render: (value) => value || 10
    },
    { 
      key: 'updated_at', 
      label: 'Last Updated', 
      width: '20%',
      render: (value) => value ? new Date(value).toLocaleString() : '-'
    },
  ];

  return (
    <div className="inventory-page">
      <div className="page-header">
        <h1 className="page-title">Inventory Management</h1>
        <Button onClick={handleOpenModal}>
          <FiPlus /> Stock Transaction
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={stockLevels} />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Stock Transaction"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="input-label">
              Product <span className="input-required">*</span>
            </label>
            <select
              className="input"
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              required
            >
              <option value="">Select Product</option>
              {Array.isArray(products) && products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="input-label">
              Transaction Type <span className="input-required">*</span>
            </label>
            <select
              className="input"
              value={formData.transaction_type}
              onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
              required
            >
              <option value="IN">Stock IN</option>
              <option value="OUT">Stock OUT</option>
            </select>
          </div>

          <Input
            label="Quantity"
            type="number"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            required
            placeholder="Enter quantity"
          />

          <Input
            label="Batch Number"
            value={formData.batch_number}
            onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
            placeholder="Optional"
          />

          <Input
            label="Expiry Date"
            type="date"
            value={formData.expiry_date}
            onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
          />

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
            <Button type="submit">Save Transaction</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;

