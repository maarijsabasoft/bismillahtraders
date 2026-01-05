import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import './Companies.css';

const Companies = () => {
  const { db, isReady } = useDatabase();
  const [companies, setCompanies] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    if (isReady && db) {
      loadCompanies();
    }
  }, [db, isReady]);

  const loadCompanies = async () => {
    try {
      const result = await db.prepare('SELECT * FROM companies ORDER BY created_at DESC').all();
      setCompanies(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading companies:', error);
      setCompanies([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingCompany) {
        await db.prepare(`
          UPDATE companies 
          SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(formData.name, formData.description || null, editingCompany.id);
      } else {
        await db.prepare('INSERT INTO companies (name, description) VALUES (?, ?)')
          .run(formData.name, formData.description || null);
      }
      await loadCompanies();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Error saving company. It may already exist.');
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({ name: company.name, description: company.description || '' });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this company?')) {
      try {
        await db.prepare('DELETE FROM companies WHERE id = ?').run(id);
        await loadCompanies();
      } catch (error) {
        console.error('Error deleting company:', error);
        alert('Cannot delete company. It may have associated products.');
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCompany(null);
    setFormData({ name: '', description: '' });
  };

  const columns = [
    { key: 'name', label: 'Company Name', width: '30%' },
    { key: 'description', label: 'Description', width: '40%' },
    { 
      key: 'created_at', 
      label: 'Created At', 
      width: '20%',
      render: (value) => new Date(value).toLocaleDateString()
    },
  ];

  return (
    <div className="companies-page">
      <div className="page-header">
        <h1 className="page-title">Companies</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <FiPlus /> Add Company
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          data={companies}
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
        title={editingCompany ? 'Edit Company' : 'Add Company'}
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="Company Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="e.g., Gourmet"
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit">
              {editingCompany ? 'Update' : 'Add'} Company
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Companies;

