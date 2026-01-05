import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Modal from '../../components/Modal/Modal';
import Table from '../../components/Table/Table';
import { FiPrinter, FiEye, FiFileText } from 'react-icons/fi';
import './Invoices.css';

// A4 Professional Invoice Component
const InvoiceA4 = ({ invoice }) => (
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
          <p><strong>Date:</strong> {new Date(invoice.sale_date).toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
          })}</p>
          <p><strong>Time:</strong> {new Date(invoice.sale_date).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
          })}</p>
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
              <td>{item.product_name}</td>
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
        <p><strong>Payment Status:</strong> 
          <span className={invoice.payment_status === 'paid' ? 'status-paid' : 'status-pending'}>
            {invoice.payment_status.toUpperCase()}
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

// Receipt Slip Component
const InvoiceSlip = ({ invoice }) => (
  <div className="invoice-slip">
    <div className="slip-header">
      <h2>BISMILLAH TRADERS</h2>
      <p>Beverages Management System</p>
      <p className="slip-address">Your Business Address</p>
      <p className="slip-contact">Tel: +92 XXX XXXXXXX</p>
      <div className="slip-divider"></div>
    </div>

    <div className="slip-info">
      <div className="slip-row">
        <span>Invoice:</span>
        <span>{invoice.invoice_number}</span>
      </div>
      <div className="slip-row">
        <span>Date:</span>
        <span>{new Date(invoice.sale_date).toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        })}</span>
      </div>
      <div className="slip-row">
        <span>Time:</span>
        <span>{new Date(invoice.sale_date).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit'
        })}</span>
      </div>
      {invoice.customer_name && (
        <div className="slip-row">
          <span>Customer:</span>
          <span>{invoice.customer_name}</span>
        </div>
      )}
    </div>

    <div className="slip-divider"></div>

    <div className="slip-items">
      {invoice.items?.map((item, index) => (
        <div key={index} className="slip-item">
          <div className="slip-item-name">{item.product_name}</div>
          <div className="slip-item-details">
            <span>{item.quantity} x Rs.{parseFloat(item.unit_price).toFixed(2)}</span>
            {item.discount > 0 && <span className="slip-discount">-{item.discount}%</span>}
            <span className="slip-item-total">Rs.{parseFloat(item.subtotal).toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>

    <div className="slip-divider"></div>

    <div className="slip-totals">
      <div className="slip-total-row">
        <span>Subtotal:</span>
        <span>Rs.{parseFloat(invoice.total_amount).toFixed(2)}</span>
      </div>
      {parseFloat(invoice.discount_amount) > 0 && (
        <div className="slip-total-row">
          <span>Discount:</span>
          <span>-Rs.{parseFloat(invoice.discount_amount).toFixed(2)}</span>
        </div>
      )}
      {parseFloat(invoice.tax_amount) > 0 && (
        <div className="slip-total-row">
          <span>Tax:</span>
          <span>Rs.{parseFloat(invoice.tax_amount).toFixed(2)}</span>
        </div>
      )}
      <div className="slip-total-row slip-total-final">
        <span>TOTAL:</span>
        <span>Rs.{parseFloat(invoice.final_amount).toFixed(2)}</span>
      </div>
    </div>

    <div className="slip-divider"></div>

    <div className="slip-footer">
      <div className="slip-payment">
        <p>Payment: {invoice.payment_method}</p>
        <p>Status: <strong>{invoice.payment_status.toUpperCase()}</strong></p>
      </div>
      <div className="slip-thanks">
        <p>Thank You!</p>
        <p>Visit Again</p>
      </div>
    </div>
  </div>
);

const Invoices = () => {
  const { db, isReady } = useDatabase();
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState('a4'); // 'a4' or 'slip'

  useEffect(() => {
    if (isReady && db) {
      loadInvoices();
    }
  }, [db, isReady]);

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

  const viewInvoice = async (invoice) => {
    try {
      const items = await db.prepare(`
        SELECT si.*, p.name as product_name
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `).all(invoice.id);

      setSelectedInvoice({ ...invoice, items: Array.isArray(items) ? items : [] });
      setIsViewModalOpen(true);
    } catch (error) {
      console.error('Error loading invoice details:', error);
    }
  };

  const printInvoice = async (invoice, format = 'a4') => {
    // Load invoice items if not already loaded
    if (!invoice.items) {
      await viewInvoice(invoice);
    } else {
      setSelectedInvoice(invoice);
    }
    setPrintFormat(format);
    // Wait a bit for state to update and DOM to render
    setTimeout(() => {
      window.print();
    }, 300);
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
                onClick={(e) => {
                  e.stopPropagation();
                  viewInvoice(row);
                }}
              >
                <FiEye /> View
              </Button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="primary"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    printInvoice(row, 'a4');
                  }}
                  title="Print A4 Invoice"
                >
                  <FiFileText /> A4
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    printInvoice(row, 'slip');
                  }}
                  title="Print Receipt Slip"
                >
                  <FiPrinter /> Slip
                </Button>
              </div>
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
              <div className="invoice-actions" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => printInvoice(selectedInvoice, 'a4')}
                >
                  <FiFileText /> Print A4
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => printInvoice(selectedInvoice, 'slip')}
                >
                  <FiPrinter /> Print Slip
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

