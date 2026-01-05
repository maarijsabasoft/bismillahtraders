import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import './Expenses.css';

const Expenses = () => {
  const { db, isReady } = useDatabase();
  const [expenses, setExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isReady && db) {
      loadExpenses();
    }
  }, [db, isReady]);

  const loadExpenses = async () => {
    try {
      const result = await db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC').all();
      setExpenses(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading expenses:', error);
      setExpenses([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category.trim() || !formData.amount) return;

    try {
      const amount = parseFloat(formData.amount);
      if (amount <= 0) {
        alert('Amount must be greater than 0');
        return;
      }

      if (editingExpense) {
        await db.prepare(`
          UPDATE expenses 
          SET category = ?, amount = ?, description = ?, expense_date = ?
          WHERE id = ?
        `).run(
          formData.category,
          amount,
          formData.description || null,
          formData.expense_date,
          editingExpense.id
        );
      } else {
        await db.prepare(`
          INSERT INTO expenses (category, amount, description, expense_date)
          VALUES (?, ?, ?, ?)
        `).run(
          formData.category,
          amount,
          formData.description || null,
          formData.expense_date
        );
      }
      await loadExpenses();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Error saving expense.');
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description || '',
      expense_date: expense.expense_date || new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
        await loadExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Cannot delete expense.');
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormData({
      category: '',
      amount: '',
      description: '',
      expense_date: new Date().toISOString().split('T')[0]
    });
  };

  const columns = [
    { key: 'expense_date', label: 'Date', width: '15%', render: (value) => new Date(value).toLocaleDateString() },
    { key: 'category', label: 'Category', width: '20%' },
    { key: 'description', label: 'Description', width: '35%' },
    { 
      key: 'amount', 
      label: 'Amount', 
      width: '15%',
      render: (value) => `Rs. ${parseFloat(value || 0).toLocaleString()}`
    },
  ];

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  return (
    <div className="expenses-page">
      <div className="page-header">
        <h1 className="page-title">Expenses</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <FiPlus /> Add Expense
        </Button>
      </div>

      <Card>
        <div className="expenses-summary">
          <div className="summary-item">
            <span className="summary-label">Total Expenses:</span>
            <span className="summary-value">Rs. {totalExpenses.toLocaleString()}</span>
          </div>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          data={expenses}
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
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="input-label">
              Category <span className="input-required">*</span>
            </label>
            <select
              className="input"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
            >
              <option value="">Select Category</option>
              <option value="Transport">Transport</option>
              <option value="Fuel">Fuel</option>
              <option value="Utilities">Utilities</option>
              <option value="Rent">Rent</option>
              <option value="Salaries">Salaries</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
          </div>
          <Input
            label="Amount"
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Expense description"
          />
          <Input
            label="Date"
            type="date"
            value={formData.expense_date}
            onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
            required
          />
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit">
              {editingExpense ? 'Update' : 'Add'} Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Expenses;

