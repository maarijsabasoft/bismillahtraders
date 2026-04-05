import React, { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useListCache } from '../../context/ListCacheContext';
import { LIST_CACHE_KEYS } from '../../context/listCacheKeys';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiEdit2, FiTrash2, FiPlus, FiDollarSign, FiClock } from 'react-icons/fi';
import { useToast } from '../../context/ToastContext';
import {
  normalizeLedgerFromRow,
  applyLedgerAdjustment,
  loadCustomerHistory,
} from '../../utils/customerLedger';
import './Customers.css';

const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

const Customers = () => {
  const { db, isReady, dataRevision } = useDatabase();
  const { toastError, toastSuccess } = useToast();
  const { readListCache, writeListCache } = useListCache();
  const [customers, setCustomers] = useState(
    () => readListCache(LIST_CACHE_KEYS.customers) ?? []
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    business_type: '',
    credit_limit: '0',
  });

  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [ledgerForm, setLedgerForm] = useState({
    field: 'total',
    direction: 'add',
    amount: '',
    note: '',
  });

  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (isReady && db) {
      loadCustomers();
    }
  }, [db, isReady, dataRevision]);

  useEffect(() => {
    writeListCache(LIST_CACHE_KEYS.customers, customers);
  }, [customers, writeListCache]);

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

  const openHistory = useCallback(
    async (row) => {
      setHistoryCustomer(row);
      setHistoryLoading(true);
      setHistoryRows([]);
      try {
        const rows = await loadCustomerHistory(db, row.id);
        setHistoryRows(rows);
      } catch (e) {
        console.error(e);
        toastError('Could not load history.');
        setHistoryRows([]);
      } finally {
        setHistoryLoading(false);
      }
    },
    [db, toastError]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      const data = {
        ...formData,
        credit_limit: parseFloat(formData.credit_limit) || 0,
      };

      if (editingCustomer) {
        await db.prepare(`
          UPDATE customers 
          SET name = ?, phone = ?, address = ?, business_type = ?,
              credit_limit = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          data.name,
          data.phone || null,
          data.address || null,
          data.business_type || null,
          data.credit_limit,
          editingCustomer.id
        );
      } else {
        await db.prepare(`
          INSERT INTO customers (name, phone, address, business_type, credit_limit, acct_total, acct_paid, outstanding_balance)
          VALUES (?, ?, ?, ?, ?, 0, 0, 0)
        `).run(
          data.name,
          data.phone || null,
          data.address || null,
          data.business_type || null,
          data.credit_limit
        );
      }
      await loadCustomers();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving customer:', error);
      toastError('Error saving customer.');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      address: customer.address || '',
      business_type: customer.business_type || '',
      credit_limit: customer.credit_limit.toString(),
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
        toastError('Cannot delete customer. It may have associated sales.');
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
      credit_limit: '0',
    });
  };

  const closeLedger = () => {
    setLedgerCustomer(null);
    setLedgerForm({ field: 'total', direction: 'add', amount: '', note: '' });
  };

  const applyLedger = async (e) => {
    e.preventDefault();
    if (!ledgerCustomer) return;
    try {
      await applyLedgerAdjustment(
        db,
        ledgerCustomer.id,
        ledgerForm.field,
        ledgerForm.direction,
        ledgerForm.amount,
        ledgerForm.note
      );
      toastSuccess('Account balances updated.');
      await loadCustomers();
      const updated = await db.prepare('SELECT * FROM customers WHERE id = ?').get(ledgerCustomer.id);
      if (updated) setLedgerCustomer({ ...ledgerCustomer, ...updated });
      setLedgerForm((f) => ({ ...f, amount: '', note: '' }));
    } catch (err) {
      console.error(err);
      toastError(err?.message || 'Could not apply adjustment.');
    }
  };

  const columns = [
    { key: 'name', label: 'Name', width: '14%' },
    { key: 'phone', label: 'Phone', width: '11%' },
    { key: 'address', label: 'Address', width: '14%' },
    { key: 'business_type', label: 'Type', width: '10%' },
    {
      key: 'acct_total',
      label: 'Total',
      width: '11%',
      render: (_, row) => fmtRs(normalizeLedgerFromRow(row).total),
    },
    {
      key: 'acct_paid',
      label: 'Paid',
      width: '11%',
      render: (_, row) => fmtRs(normalizeLedgerFromRow(row).paid),
    },
    {
      key: 'remaining',
      label: 'Remaining',
      width: '11%',
      render: (_, row) => {
        const r = normalizeLedgerFromRow(row).remaining;
        return (
          <span style={{ color: r > 0.005 ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
            {fmtRs(r)}
          </span>
        );
      },
    },
    {
      key: 'total_purchased',
      label: 'Purchased',
      width: '12%',
      render: (value) => fmtRs(value),
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
                className="btn-icon-only"
                title="Adjust total / paid / remaining"
                aria-label="Adjust account balance"
                onClick={(e) => {
                  e.stopPropagation();
                  setLedgerCustomer(row);
                  setLedgerForm({ field: 'total', direction: 'add', amount: '', note: '' });
                }}
              >
                <FiDollarSign />
              </Button>
              <Button
                variant="secondary"
                size="small"
                className="btn-icon-only"
                title="Balance change history"
                aria-label="History"
                onClick={(e) => {
                  e.stopPropagation();
                  openHistory(row);
                }}
              >
                <FiClock />
              </Button>
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
          {editingCustomer && (
            <p className="customers-balance-readonly">
              <strong>Account:</strong> Total {fmtRs(normalizeLedgerFromRow(editingCustomer).total)} · Paid{' '}
              {fmtRs(normalizeLedgerFromRow(editingCustomer).paid)} · Remaining{' '}
              {fmtRs(normalizeLedgerFromRow(editingCustomer).remaining)}. Sales on credit increase total
              owed. Use the balance ($) and history icons on the table row to adjust amounts or view the log.
            </p>
          )}
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit">{editingCustomer ? 'Update' : 'Add'} Customer</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!ledgerCustomer}
        onClose={closeLedger}
        title={ledgerCustomer ? `Account — ${ledgerCustomer.name}` : ''}
        size="large"
      >
        {ledgerCustomer && (
          <div className="customers-ledger">
            <div className="customers-ledger-summary">
              <div>
                <span className="customers-ledger-label">Total amount</span>
                <strong>{fmtRs(normalizeLedgerFromRow(ledgerCustomer).total)}</strong>
              </div>
              <div>
                <span className="customers-ledger-label">Amount paid</span>
                <strong>{fmtRs(normalizeLedgerFromRow(ledgerCustomer).paid)}</strong>
              </div>
              <div>
                <span className="customers-ledger-label">Remaining</span>
                <strong className="customers-ledger-remaining">
                  {fmtRs(normalizeLedgerFromRow(ledgerCustomer).remaining)}
                </strong>
              </div>
            </div>
            <p className="customers-ledger-hint">
              Remaining = Total − Paid (updated automatically). Adjust <strong>Total</strong> to change what
              they owe; adjust <strong>Paid</strong> when they pay; adjust <strong>Remaining</strong> to add
              debt (add) or record a payment (subtract).
            </p>
            <form onSubmit={applyLedger} className="customers-ledger-form">
              <div className="form-group">
                <label className="input-label">Apply to</label>
                <select
                  className="input"
                  value={ledgerForm.field}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, field: e.target.value })}
                >
                  <option value="total">Total amount</option>
                  <option value="paid">Amount paid</option>
                  <option value="remaining">Remaining amount</option>
                </select>
              </div>
              <div className="form-group">
                <label className="input-label">Operation</label>
                <select
                  className="input"
                  value={ledgerForm.direction}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, direction: e.target.value })}
                >
                  <option value="add">Add</option>
                  <option value="subtract">Subtract</option>
                </select>
              </div>
              <Input
                label="Amount (Rs.)"
                type="number"
                step="0.01"
                min="0"
                value={ledgerForm.amount}
                onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                required
              />
              <Input
                label="Note (optional)"
                value={ledgerForm.note}
                onChange={(e) => setLedgerForm({ ...ledgerForm, note: e.target.value })}
                placeholder="e.g. Cash payment, correction"
              />
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={closeLedger}>
                  Close
                </Button>
                <Button type="submit">Apply update</Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!historyCustomer}
        onClose={() => {
          setHistoryCustomer(null);
          setHistoryRows([]);
        }}
        title={historyCustomer ? `History — ${historyCustomer.name}` : ''}
        size="large"
      >
        {historyCustomer && (
          <div className="customers-history">
            {historyLoading ? (
              <p className="customers-history-empty">Loading…</p>
            ) : historyRows.length === 0 ? (
              <p className="customers-history-empty">No balance changes recorded yet.</p>
            ) : (
              <div className="customers-history-table-wrap">
                <table className="customers-history-table">
                  <thead>
                    <tr>
                      <th>Date &amp; time</th>
                      <th>Field</th>
                      <th>Change</th>
                      <th>Amount</th>
                      <th>After — Total</th>
                      <th>Paid</th>
                      <th>Remaining</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((h) => {
                      const d = h.entry_date ? new Date(h.entry_date) : null;
                      const dt =
                        d && !Number.isNaN(d.getTime())
                          ? d.toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—';
                      const fieldLabel =
                        h.field_changed === 'total'
                          ? 'Total'
                          : h.field_changed === 'paid'
                            ? 'Paid'
                            : h.field_changed === 'remaining'
                              ? 'Remaining'
                              : h.field_changed;
                      const op = h.direction === 'add' ? 'Added to' : 'Subtracted from';
                      return (
                        <tr key={h.id}>
                          <td>{dt}</td>
                          <td>{fieldLabel}</td>
                          <td>{op}</td>
                          <td>{fmtRs(h.amount)}</td>
                          <td>{fmtRs(h.total_after)}</td>
                          <td>{fmtRs(h.paid_after)}</td>
                          <td>{fmtRs(h.remaining_after)}</td>
                          <td>{h.note || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Customers;
