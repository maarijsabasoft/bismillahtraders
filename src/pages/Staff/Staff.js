import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import './Staff.css';

const Staff = () => {
  const { db, isReady } = useDatabase();
  const [staff, setStaff] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'Cashier',
    salary: '0',
    hire_date: '',
    is_active: true
  });

  useEffect(() => {
    if (isReady && db) {
      loadStaff();
    }
  }, [db, isReady]);

  const loadStaff = async () => {
    try {
      const result = await db.prepare('SELECT * FROM staff ORDER BY created_at DESC').all();
      setStaff(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading staff:', error);
      setStaff([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const data = {
        ...formData,
        salary: parseFloat(formData.salary) || 0,
        is_active: formData.is_active ? 1 : 0
      };

      if (editingStaff) {
        await db.prepare(`
          UPDATE staff 
          SET name = ?, phone = ?, email = ?, role = ?, salary = ?,
              hire_date = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          data.name, data.phone || null, data.email || null, data.role,
          data.salary, data.hire_date || null, data.is_active, editingStaff.id
        );
      } else {
        await db.prepare(`
          INSERT INTO staff (name, phone, email, role, salary, hire_date, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.name, data.phone || null, data.email || null, data.role,
          data.salary, data.hire_date || null, data.is_active
        );
      }
      await loadStaff();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving staff:', error);
      alert('Error saving staff member.');
    }
  };

  const handleEdit = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      phone: staffMember.phone || '',
      email: staffMember.email || '',
      role: staffMember.role,
      salary: staffMember.salary.toString(),
      hire_date: staffMember.hire_date || '',
      is_active: staffMember.is_active === 1
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await db.prepare('DELETE FROM staff WHERE id = ?').run(id);
        await loadStaff();
      } catch (error) {
        console.error('Error deleting staff:', error);
        alert('Cannot delete staff member.');
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStaff(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      role: 'Cashier',
      salary: '0',
      hire_date: '',
      is_active: true
    });
  };

  const columns = [
    { key: 'name', label: 'Name', width: '20%' },
    { key: 'phone', label: 'Phone', width: '15%' },
    { key: 'email', label: 'Email', width: '20%' },
    { key: 'role', label: 'Role', width: '15%' },
    { 
      key: 'salary', 
      label: 'Salary', 
      width: '15%',
      render: (value) => `Rs. ${parseFloat(value || 0).toLocaleString()}`
    },
    { 
      key: 'is_active', 
      label: 'Status', 
      width: '10%',
      render: (value) => (
        <span className={value === 1 ? 'status-active' : 'status-inactive'}>
          {value === 1 ? 'Active' : 'Inactive'}
        </span>
      )
    },
  ];

  return (
    <div className="staff-page">
      <div className="page-header">
        <h1 className="page-title">Staff Management</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <FiPlus /> Add Staff
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          data={staff}
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
        title={editingStaff ? 'Edit Staff' : 'Add Staff'}
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div className="form-row">
            <Input
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="input-label">Role</label>
            <select
              className="input"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Cashier">Cashier</option>
            </select>
          </div>
          <div className="form-row">
            <Input
              label="Salary"
              type="number"
              step="0.01"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
            />
            <Input
              label="Hire Date"
              type="date"
              value={formData.hire_date}
              onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="input-label">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                style={{ marginRight: 8 }}
              />
              Active
            </label>
          </div>
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit">
              {editingStaff ? 'Update' : 'Add'} Staff
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Staff;

