import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import './Customers.css';

const Customers = () => {
  const { db, isReady } = useDatabase();
  const [customers, setCustomers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    business_type: '',
    credit_limit: '0'
  });

  useEffect(() => {
    if (isReady && db) {
      loadCustomers();
    }
  }, [db, isReady]);

  const loadCustomers = async () => {
    try {
      const result = await db.prepare(`
        SELECT c.*,
               COALESCE(SUM(s.final_amount), 0) as total_purchased
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id
        GROUP BY c.id
        ORDER BY c.created_at DESC
      `).all();
      setCustomers(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const data = {
        ...formData,
        credit_limit: parseFloat(formData.credit_limit) || 0
      };

      if (editingCustomer) {
        await db.prepare(`
          UPDATE customers 
          SET name = ?, phone = ?, address = ?, business_type = ?,
              credit_limit = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          data.name, data.phone || null, data.address || null,
          data.business_type || null, data.credit_limit, editingCustomer.id
        );
      } else {
        await db.prepare(`
          INSERT INTO customers (name, phone, address, business_type, credit_limit)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          data.name, data.phone || null, data.address || null,
          data.business_type || null, data.credit_limit
        );
      }
      await loadCustomers();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error saving customer.');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      business_type: customer.business_type || '',
      credit_limit: customer.credit_limit.toString()
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await db.prepare('DELETE FROM customers WHERE id = ?').run(id);
        await loadCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Cannot delete customer. It may have associated sales.');
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      address: '',
      business_type: '',
      credit_limit: '0'
    });
  };

  const columns = [
    { key: 'name', label: 'Name', width: '20%' },
    { key: 'phone', label: 'Phone', width: '15%' },
    { key: 'address', label: 'Address', width: '20%' },
    { key: 'business_type', label: 'Business Type', width: '15%' },
    { 
      key: 'total_purchased', 
      label: 'Total Purchased', 
      width: '15%',
      render: (value) => `Rs. ${parseFloat(value || 0).toLocaleString()}`
    },
    { 
      key: 'outstanding_balance', 
      label: 'Outstanding', 
      width: '15%',
      render: (value) => (
        <span style={{ color: parseFloat(value || 0) > 0 ? '#d32f2f' : '#388e3c' }}>
          Rs. {parseFloat(value || 0).toLocaleString()}
        </span>
      )
    },
  ];

  return (
    <div className="customers-page">
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <FiPlus /> Add Customer
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          data={customers}
          actions={(row) => (
            <>
              <Button
                variant="secondary"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(row);
                }}
              >
                <FiEdit2 />
              </Button>
              <Button
                variant="danger"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(row.id);
                }}
              >
                <FiTrash2 />
              </Button>
            </>
          )}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="Customer Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="Phone number"
          />
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Address"
          />
          <div className="form-group">
            <label className="input-label">Business Type</label>
            <select
              className="input"
              value={formData.business_type}
              onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
            >
              <option value="">Select Type</option>
              <option value="Retailer">Retailer</option>
              <option value="Shop">Shop</option>
              <option value="Hotel">Hotel</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <Input
            label="Credit Limit"
            type="number"
            step="0.01"
            value={formData.credit_limit}
            onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
          />
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit">
              {editingCustomer ? 'Update' : 'Add'} Customer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Customers;

