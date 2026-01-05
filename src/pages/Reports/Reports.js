import React, { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Table from '../../components/Table/Table';
import './Reports.css';

const Reports = () => {
  const { db, isReady } = useDatabase();
  const [reportType, setReportType] = useState('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({ totalSales: 0, totalProfit: 0, totalExpenses: 0 });

  const generateReport = useCallback(async () => {
    try {
      let salesQuery = '';
      let params = [];

      if (reportType === 'daily') {
        salesQuery = `
          SELECT s.*, c.name as customer_name
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          WHERE DATE(s.sale_date) = ?
          ORDER BY s.sale_date DESC
        `;
        params = [startDate];
      } else if (reportType === 'weekly') {
        salesQuery = `
          SELECT s.*, c.name as customer_name
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          WHERE DATE(s.sale_date) BETWEEN ? AND ?
          ORDER BY s.sale_date DESC
        `;
        params = [startDate, endDate];
      } else {
        salesQuery = `
          SELECT s.*, c.name as customer_name
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          WHERE DATE(s.sale_date) BETWEEN ? AND ?
          ORDER BY s.sale_date DESC
        `;
        params = [startDate, endDate];
      }

      const sales = await db.prepare(salesQuery).all(...params);
      
      // Calculate profit for each sale
      const salesWithProfit = await Promise.all(sales.map(async (sale) => {
        const items = await db.prepare(`
          SELECT si.*, p.purchase_price, p.sale_price
          FROM sale_items si
          LEFT JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = ?
        `).all(sale.id);

        let profit = 0;
        items.forEach(item => {
          const cost = (item.purchase_price || 0) * item.quantity;
          const revenue = parseFloat(item.subtotal);
          profit += revenue - cost;
        });

        return { ...sale, profit };
      }));

      setReportData(Array.isArray(salesWithProfit) ? salesWithProfit : []);

      // Calculate summary
      const totalSales = salesWithProfit.reduce((sum, s) => sum + parseFloat(s.final_amount || 0), 0);
      const totalProfit = salesWithProfit.reduce((sum, s) => sum + (s.profit || 0), 0);
      
      const expenses = await db.prepare(`
        SELECT SUM(amount) as total FROM expenses
        WHERE DATE(expense_date) BETWEEN ? AND ?
      `).get(startDate, endDate);
      const totalExpenses = parseFloat(expenses?.total || 0);

      setSummary({ totalSales, totalProfit, totalExpenses });
    } catch (error) {
      console.error('Error generating report:', error);
      setReportData([]);
      setSummary({ totalSales: 0, totalProfit: 0, totalExpenses: 0 });
    }
  }, [db, reportType, startDate, endDate]);

  useEffect(() => {
    if (isReady && db) {
      generateReport();
    }
  }, [isReady, db, generateReport]);

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
      label: 'Sales Amount', 
      width: '15%',
      render: (value) => `Rs. ${parseFloat(value || 0).toLocaleString()}`
    },
    { 
      key: 'profit', 
      label: 'Profit', 
      width: '15%',
      render: (value) => (
        <span style={{ color: parseFloat(value || 0) >= 0 ? '#388e3c' : '#d32f2f' }}>
          Rs. {parseFloat(value || 0).toFixed(2)}
        </span>
      )
    },
    { key: 'payment_method', label: 'Payment', width: '10%' },
  ];

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
      </div>

      <Card>
        <div className="report-filters">
          <div className="form-group">
            <label className="input-label">Report Type</label>
            <select
              className="input"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Button onClick={generateReport}>Generate Report</Button>
        </div>
      </Card>

      <div className="report-summary">
        <Card>
          <div className="summary-item">
            <div className="summary-label">Total Sales</div>
            <div className="summary-value">Rs. {summary.totalSales.toLocaleString()}</div>
          </div>
        </Card>
        <Card>
          <div className="summary-item">
            <div className="summary-label">Total Profit</div>
            <div className="summary-value" style={{ color: summary.totalProfit >= 0 ? '#388e3c' : '#d32f2f' }}>
              Rs. {summary.totalProfit.toFixed(2)}
            </div>
          </div>
        </Card>
        <Card>
          <div className="summary-item">
            <div className="summary-label">Total Expenses</div>
            <div className="summary-value">Rs. {summary.totalExpenses.toLocaleString()}</div>
          </div>
        </Card>
        <Card>
          <div className="summary-item">
            <div className="summary-label">Net Profit</div>
            <div className="summary-value" style={{ color: (summary.totalProfit - summary.totalExpenses) >= 0 ? '#388e3c' : '#d32f2f' }}>
              Rs. {(summary.totalProfit - summary.totalExpenses).toFixed(2)}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <Table columns={columns} data={reportData} />
      </Card>
    </div>
  );
};

export default Reports;

