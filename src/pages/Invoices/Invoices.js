import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useListCache } from '../../context/ListCacheContext';
import { LIST_CACHE_KEYS } from '../../context/listCacheKeys';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiPrinter, FiEye, FiFileText, FiTrash2 } from 'react-icons/fi';
import { useToast } from '../../context/ToastContext';
import { deleteSaleById } from '../../utils/saleDelete';
import './Invoices.css';

function saleCashBank(invoice) {
  const cash = Number(invoice?.cash_amount ?? invoice?.cashAmount ?? 0) || 0;
  const bank = Number(invoice?.bank_amount ?? invoice?.bankAmount ?? 0) || 0;
  const label = invoice?.bank_account_label || invoice?.bankAccountLabel || '';
  return { cash, bank, label };
}

/** Stable id for matching line items (SQLite / Mongo). */
function invoiceRowId(invoice) {
  if (!invoice) return '';
  const v = invoice.id ?? invoice._id;
  return v != null ? String(v) : '';
}

/** Keep only rows belonging to this sale (Mongo WHERE alias fix + type safety). */
function filterItemsForInvoice(invoice, rows) {
  const sid = invoiceRowId(invoice);
  if (!sid || !Array.isArray(rows)) return [];
  return rows.filter((row) => {
    const r = row.sale_id ?? row.saleId;
    return r != null && String(r) === sid;
  });
}

/** Mongo / SQLite / serialized shapes — avoids Invalid Date in print preview. */
function parseInvoiceDate(invoice) {
  const raw =
    invoice?.sale_date ??
    invoice?.saleDate ??
    invoice?.created_at ??
    invoice?.createdAt;
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && raw !== null) {
    if (raw.$date != null) {
      const d = new Date(raw.$date);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatInvoiceDate(d) {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatInvoiceTime(d) {
  if (!d) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function lineProductName(item) {
  return item?.product_name || item?.name || item?.productName || 'Item';
}

// A4 Professional Invoice Component
const InvoiceA4 = ({ invoice }) => {
  const saleD = parseInvoiceDate(invoice);
  return (
  <div className="invoice-a4">
    <div className="invoice-header">
      <div className="company-info">
                <h1>Bismillah Traders</h1>
        <p className="company-tagline">Beverages Management System</p>
        <p className="company-address">Your Business Address Here</p>
        <p className="company-contact">Phone: +92 XXX XXXXXXX | Email: info@farhantraders.com</p>
      </div>
      <div className="invoice-info">
        <h2>INVOICE</h2>
        <div className="info-box">
          <p><strong>Invoice #:</strong> {invoice.invoice_number}</p>
          <p><strong>Date:</strong> {formatInvoiceDate(saleD)}</p>
          <p><strong>Time:</strong> {formatInvoiceTime(saleD)}</p>
        </div>
      </div>
    </div>

    {invoice.customer_name && (
      <div className="invoice-customer">
        <h3>Bill To:</h3>
        <div className="customer-details">
          <p><strong>{invoice.customer_name}</strong></p>
          {invoice.customer_phone && <p>Phone: {invoice.customer_phone}</p>}
          {invoice.customer_address && <p>Address: {invoice.customer_address}</p>}
        </div>
      </div>
    )}

    <div className="invoice-items">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Product Name</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit Price</th>
            <th className="text-right">Discount</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{lineProductName(item)}</td>
              <td className="text-right">{item.quantity}</td>
              <td className="text-right">Rs. {parseFloat(item.unit_price).toFixed(2)}</td>
              <td className="text-right">{item.discount}%</td>
              <td className="text-right">Rs. {parseFloat(item.subtotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="invoice-totals">
      <div className="totals-section">
        <div className="total-row">
          <span>Subtotal:</span>
          <span>Rs. {parseFloat(invoice.total_amount).toFixed(2)}</span>
        </div>
        <div className="total-row">
          <span>Discount:</span>
          <span>- Rs. {parseFloat(invoice.discount_amount).toFixed(2)}</span>
        </div>
        <div className="total-row">
          <span>Tax:</span>
          <span>Rs. {parseFloat(invoice.tax_amount).toFixed(2)}</span>
        </div>
        <div className="total-row total-final">
          <span>Total Amount:</span>
          <span>Rs. {parseFloat(invoice.final_amount).toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div className="invoice-footer">
      <div className="payment-info">
        <p><strong>Payment Method:</strong> {invoice.payment_method}</p>
        {(() => {
          const { cash, bank, label } = saleCashBank(invoice);
          if (cash > 0 || bank > 0) {
            return (
              <>
                {cash > 0 && (
                  <p>
                    <strong>Cash paid:</strong> Rs. {cash.toFixed(2)}
                  </p>
                )}
                {bank > 0 && (
                  <p>
                    <strong>Bank{label ? ` (${label})` : ''}:</strong> Rs. {bank.toFixed(2)}
                  </p>
                )}
              </>
            );
          }
          return null;
        })()}
        <p><strong>Payment Status:</strong> 
          <span className={invoice.payment_status === 'paid' ? 'status-paid' : 'status-pending'}>
            {String(invoice.payment_status || '').toUpperCase()}
          </span>
        </p>
      </div>
      {invoice.notes && (
        <div className="notes-section">
          <p><strong>Notes:</strong> {invoice.notes}</p>
        </div>
      )}
      <div className="footer-message">
        <p>Thank you for your business!</p>
        <p className="terms">Terms & Conditions: All sales are final. Returns accepted within 7 days.</p>
      </div>
    </div>
  </div>
  );
};

// Receipt slip — thermal-style (2.5 inch)
const InvoiceSlip = ({ invoice }) => {
  const saleD = parseInvoiceDate(invoice);
  return (
  <div className="invoice-slip">
    <div className="slip-receipt-title">CASH RECEIPT</div>

    <div className="slip-header slip-header--compact">
      <h2 className="slip-store-name">BISMILLAH TRADERS</h2>
      <p className="slip-sub">Beverages Management System</p>
      <p className="slip-address">Your Business Address</p>
      <p className="slip-contact">Tel: +92 XXX XXXXXXX</p>
    </div>

    <div className="slip-divider slip-divider--dashed" aria-hidden="true" />

    <div className="slip-info">
      <div className="slip-row">
        <span>Receipt</span>
        <span>{invoice.invoice_number}</span>
      </div>
      <div className="slip-row">
        <span>Date</span>
        <span>{formatInvoiceDate(saleD)}</span>
      </div>
      <div className="slip-row">
        <span>Time</span>
        <span>{formatInvoiceTime(saleD)}</span>
      </div>
      {invoice.customer_name && (
        <div className="slip-row">
          <span>Customer</span>
          <span className="slip-row__val">{invoice.customer_name}</span>
        </div>
      )}
    </div>

    <div className="slip-divider slip-divider--dashed" aria-hidden="true" />

    <div className="slip-items">
      {invoice.items?.map((item, index) => {
        const name = lineProductName(item);
        const qty = item.quantity;
        const unit = parseFloat(item.unit_price);
        const sub = parseFloat(item.subtotal);
        return (
          <div key={index} className="slip-item slip-item--receipt">
            <div className="slip-item-num">
              {index + 1}. {name}
            </div>
            <div className="slip-cost-line">
              <span className="slip-cost-label">Qty {qty} × Rs.{unit.toFixed(2)}</span>
              <span className="slip-cost-dots" aria-hidden="true" />
              <span className="slip-cost-amt">Rs.{sub.toFixed(2)}</span>
            </div>
            {parseFloat(item.discount) > 0 && (
              <div className="slip-discount-note">Disc. {item.discount}%</div>
            )}
          </div>
        );
      })}
    </div>

    <div className="slip-divider slip-divider--dashed" aria-hidden="true" />

    <div className="slip-totals slip-totals--receipt">
      <div className="slip-cost-line slip-total-line">
        <span>Subtotal</span>
        <span className="slip-cost-dots" aria-hidden="true" />
        <span>Rs.{parseFloat(invoice.total_amount).toFixed(2)}</span>
      </div>
      {parseFloat(invoice.discount_amount) > 0 && (
        <div className="slip-cost-line slip-total-line">
          <span>Discount</span>
          <span className="slip-cost-dots" aria-hidden="true" />
          <span>-Rs.{parseFloat(invoice.discount_amount).toFixed(2)}</span>
        </div>
      )}
      {parseFloat(invoice.tax_amount) > 0 && (
        <div className="slip-cost-line slip-total-line">
          <span>Tax</span>
          <span className="slip-cost-dots" aria-hidden="true" />
          <span>Rs.{parseFloat(invoice.tax_amount).toFixed(2)}</span>
        </div>
      )}
      <div className="slip-total-final slip-total-final--receipt">
        <span>TOTAL</span>
        <span>Rs.{parseFloat(invoice.final_amount).toFixed(2)}</span>
      </div>
    </div>

    <div className="slip-divider slip-divider--dashed" aria-hidden="true" />

    <div className="slip-footer slip-footer--receipt">
      <div className="slip-payment">
        <p>Payment: {invoice.payment_method}</p>
        {(() => {
          const { cash, bank, label } = saleCashBank(invoice);
          return (
            <>
              {cash > 0 && <p>Cash: Rs.{cash.toFixed(2)}</p>}
              {bank > 0 && <p>Bank{label ? ` (${label})` : ''}: Rs.{bank.toFixed(2)}</p>}
            </>
          );
        })()}
        <p>Status: <strong>{String(invoice.payment_status || '').toUpperCase()}</strong></p>
      </div>
      <div className="slip-barcode-line" aria-hidden="true">
        *{String(invoice.invoice_number || '').replace(/\s/g, '')}*
      </div>
      <div className="slip-thanks slip-thanks--caps">
        <p>THANK YOU FOR SHOPPING!</p>
        <p className="slip-thanks-sub">Visit again</p>
      </div>
    </div>
  </div>
  );
};

const Invoices = () => {
  const { db, isReady, dataRevision } = useDatabase();
  const { toastError, toastSuccess } = useToast();
  const { readListCache, writeListCache } = useListCache();
  const [invoices, setInvoices] = useState(
    () => readListCache(LIST_CACHE_KEYS.invoices) ?? []
  );
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState('a4'); // 'a4' or 'slip'

  useEffect(() => {
    if (isReady && db) {
      loadInvoices();
    }
  }, [db, isReady, dataRevision]);

  useEffect(() => {
    writeListCache(LIST_CACHE_KEYS.invoices, invoices);
  }, [invoices, writeListCache]);

  const loadInvoices = async () => {
    try {
      const result = await db.prepare(`
        SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        ORDER BY s.sale_date DESC
      `).all();
      setInvoices(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setInvoices([]);
    }
  };

  const loadInvoiceWithItems = async (invoice) => {
    const saleKey = invoice?.id ?? invoice?._id;
    const raw = await db.prepare(`
        SELECT si.*, p.name as product_name
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `).all(saleKey);
    const items = filterItemsForInvoice(invoice, raw);
    return { ...invoice, items };
  };

  const viewInvoice = async (invoice) => {
    try {
      const full = await loadInvoiceWithItems(invoice);
      setSelectedInvoice(full);
      setIsViewModalOpen(true);
    } catch (error) {
      console.error('Error loading invoice details:', error);
    }
  };

  const printInvoice = async (invoice, format = 'a4') => {
    try {
      setPrintFormat(format);
      const full = await loadInvoiceWithItems(invoice);
      setSelectedInvoice(full);
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      setTimeout(() => window.print(), 200);
    } catch (error) {
      console.error('Error preparing print:', error);
    }
  };

  const handleDeleteInvoice = async (row) => {
    const inv = row.invoice_number || row.id;
    if (
      !window.confirm(
        `Delete invoice ${inv}? This removes the sale, restores stock, and reverses any unpaid amount on the customer for this invoice.`
      )
    ) {
      return;
    }
    try {
      await deleteSaleById(db, row.id);
      await loadInvoices();
      if (selectedInvoice && String(selectedInvoice.id) === String(row.id)) {
        setSelectedInvoice(null);
        setIsViewModalOpen(false);
      }
      toastSuccess(`Invoice ${inv} deleted.`);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toastError(error?.message || 'Could not delete invoice.');
    }
  };

  const columns = [
    { key: 'invoice_number', label: 'Invoice #', width: '15%' },
    { key: 'customer_name', label: 'Customer', width: '20%' },
    { 
      key: 'sale_date', 
      label: 'Date', 
      width: '15%',
      render: (value) => new Date(value).toLocaleDateString()
    },
    { 
      key: 'final_amount', 
      label: 'Amount', 
      width: '15%',
      render: (value) => `Rs. ${parseFloat(value || 0).toLocaleString()}`
    },
    { key: 'payment_method', label: 'Payment', width: '15%' },
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
    <div className="invoices-page">
      <div className="page-header">
        <h1 className="page-title">Invoices</h1>
      </div>

      <Card>
        <Table
          columns={columns}
          data={invoices}
          actions={(row) => (
            <>
              <Button
                variant="secondary"
                size="small"
                className="btn-icon-only"
                title="View invoice"
                aria-label="View invoice"
                onClick={(e) => {
                  e.stopPropagation();
                  viewInvoice(row);
                }}
              >
                <FiEye />
              </Button>
              <Button
                variant="primary"
                size="small"
                className="btn-icon-only"
                title="Print A4 invoice"
                aria-label="Print A4 invoice"
                onClick={(e) => {
                  e.stopPropagation();
                  printInvoice(row, 'a4');
                }}
              >
                <FiFileText />
              </Button>
              <Button
                variant="secondary"
                size="small"
                className="btn-icon-only"
                title="Print receipt slip (2.5 inch)"
                aria-label="Print receipt slip"
                onClick={(e) => {
                  e.stopPropagation();
                  printInvoice(row, 'slip');
                }}
              >
                <FiPrinter />
              </Button>
              <Button
                variant="danger"
                size="small"
                className="btn-icon-only"
                title="Delete invoice"
                aria-label="Delete invoice"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteInvoice(row);
                }}
              >
                <FiTrash2 />
              </Button>
            </>
          )}
        />
      </Card>

      {selectedInvoice && (
        <>
          <Modal
            isOpen={isViewModalOpen}
            onClose={() => setIsViewModalOpen(false)}
            title={`Invoice ${selectedInvoice.invoice_number}`}
            size="large"
          >
            <div className="invoice-view">
              <div className="invoice-actions">
                <Button
                  variant="primary"
                  size="small"
                  className="btn-icon-only"
                  title="Print A4 invoice"
                  aria-label="Print A4 invoice"
                  onClick={() => printInvoice(selectedInvoice, 'a4')}
                >
                  <FiFileText />
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  className="btn-icon-only"
                  title="Print receipt slip (2.5 inch)"
                  aria-label="Print receipt slip"
                  onClick={() => printInvoice(selectedInvoice, 'slip')}
                >
                  <FiPrinter />
                </Button>
                <Button
                  variant="danger"
                  size="small"
                  className="btn-icon-only"
                  title="Delete invoice"
                  aria-label="Delete invoice"
                  onClick={() => handleDeleteInvoice(selectedInvoice)}
                >
                  <FiTrash2 />
                </Button>
              </div>
              
              <div className={`invoice-container invoice-${printFormat}`}>
                {printFormat === 'a4' ? (
                  <InvoiceA4 invoice={selectedInvoice} />
                ) : (
                  <InvoiceSlip invoice={selectedInvoice} />
                )}
              </div>
            </div>
          </Modal>
          
          {/* Hidden print containers - always rendered for printing */}
          <div className="print-container">
            <div className={`invoice-print invoice-a4-print ${printFormat === 'a4' ? 'active' : ''}`}>
              {selectedInvoice && <InvoiceA4 invoice={selectedInvoice} />}
            </div>
            <div className={`invoice-print invoice-slip-print ${printFormat === 'slip' ? 'active' : ''}`}>
              {selectedInvoice && <InvoiceSlip invoice={selectedInvoice} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Invoices;

