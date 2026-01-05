import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import './Suppliers.css';

const Suppliers = () => {
  const { db, isReady } = useDatabase();
  const [suppliers, setSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    contact_person: ''
  });

  useEffect(() => {
    if (isReady && db) {
      loadSuppliers();
    }
  }, [db, isReady]);

  const loadSuppliers = async () => {
    try {
      const result = await db.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all();
      setSuppliers(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      setSuppliers([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingSupplier) {
        await db.prepare(`
          UPDATE suppliers 
          SET name = ?, phone = ?, address = ?, contact_person = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          formData.name, formData.phone || null, formData.address || null,
          formData.contact_person || null, editingSupplier.id
        );
      } else {
        await db.prepare(`
          INSERT INTO suppliers (name, phone, address, contact_person)
          VALUES (?, ?, ?, ?)
        `).run(
          formData.name, formData.phone || null, formData.address || null,
          formData.contact_person || null
        );
      }
      await loadSuppliers();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving supplier:', error);
      alert('Error saving supplier.');
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || '',
      contact_person: supplier.contact_person || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this supplier?')) {
      try {
        await db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
        await loadSuppliers();
      } catch (error) {
        console.error('Error deleting supplier:', error);
        alert('Cannot delete supplier.');
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
    setFormData({
      name: '',
      phone: '',
      address: '',
      contact_person: ''
    });
  };

  const columns = [
    { key: 'name', label: 'Supplier Name', width: '25%' },
    { key: 'phone', label: 'Phone', width: '15%' },
    { key: 'address', label: 'Address', width: '25%' },
    { key: 'contact_person', label: 'Contact Person', width: '20%' },
    { 
      key: 'payable_balance', 
      label: 'Payable Balance', 
      width: '15%',
      render: (value) => (
        <span style={{ color: parseFloat(value || 0) > 0 ? '#d32f2f' : '#388e3c' }}>
          Rs. {parseFloat(value || 0).toLocaleString()}
        </span>
      )
    },
  ];

  return (
    <div className="suppliers-page">
      <div className="page-header">
        <h1 className="page-title">Suppliers</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <FiPlus /> Add Supplier
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          data={suppliers}
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
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="Supplier Name"
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
          <Input
            label="Contact Person"
            value={formData.contact_person}
            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
            placeholder="Contact person name"
          />
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit">
              {editingSupplier ? 'Update' : 'Add'} Supplier
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Suppliers;

