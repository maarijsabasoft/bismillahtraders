import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import { formatDate } from '../../utils/dateUtils';
import { mongoCrudErrorMessage } from '../../utils/mongoErrors';
import './Companies.css';

const Companies = () => {
  const { db, isReady, dbMode, dataRevision } = useDatabase();
  const [companies, setCompanies] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    if (isReady && db) {
      loadCompanies();
    }
  }, [db, isReady, dataRevision]);

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

    const name = formData.name.trim();
    const description = formData.description || null;
    const now = new Date().toISOString();

    if (editingCompany) {
      const ed = editingCompany;
      const id = ed.id;
      const snapshot = companies.map((c) => ({ ...c }));
      setCompanies((prev) =>
        prev.map((c) =>
          String(c.id) === String(id)
            ? { ...c, name, description, updated_at: now }
            : c
        )
      );
      handleCloseModal();
      try {
        await db.prepare(`
          UPDATE companies 
          SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(name, description, id);
      } catch (error) {
        console.error('Error saving company:', error);
        setCompanies(snapshot);
        setEditingCompany(ed);
        setFormData({ name, description: description || '' });
        setIsModalOpen(true);
        alert(
          `Could not save company.\n\n${mongoCrudErrorMessage(error, dbMode, {
            duplicateHint: 'A company with this name already exists. Use a different name.',
          })}`
        );
      }
      return;
    }

    const tempId = `__pending_${Date.now()}`;
    setCompanies((prev) => [
      { id: tempId, name, description, created_at: now, updated_at: now, __pending: true },
      ...prev,
    ]);
    handleCloseModal();

    try {
      const out = await db
        .prepare('INSERT INTO companies (name, description) VALUES (?, ?)')
        .run(name, description);
      const newId = out?.lastInsertRowid != null ? String(out.lastInsertRowid) : null;
      if (newId) {
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? { id: newId, name, description, created_at: now, updated_at: now }
              : c
          )
        );
      } else {
        await loadCompanies();
      }
    } catch (error) {
      console.error('Error saving company:', error);
      setCompanies((prev) => prev.filter((c) => c.id !== tempId));
      alert(
        `Could not save company.\n\n${mongoCrudErrorMessage(error, dbMode, {
          duplicateHint: 'A company with this name already exists. Use a different name.',
        })}`
      );
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({ name: company.name, description: company.description || '' });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (String(id).startsWith('__pending_')) return;
    if (window.confirm('Are you sure you want to delete this company?')) {
      const snapshot = companies.map((c) => ({ ...c }));
      const idStr = String(id);
      setCompanies((prev) => prev.filter((c) => String(c.id) !== idStr));
      try {
        await db.prepare('DELETE FROM companies WHERE id = ?').run(id);
      } catch (error) {
        console.error('Error deleting company:', error);
        setCompanies(snapshot);
        alert(`Could not delete company.\n\n${mongoCrudErrorMessage(error, dbMode)}`);
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
      render: (value) => formatDate(value)
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
          actions={(row) => {
            const pending = String(row.id).startsWith('__pending_');
            return (
              <>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={pending}
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
                  disabled={pending}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(row.id);
                  }}
                >
                  <FiTrash2 />
                </Button>
              </>
            );
          }}
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

