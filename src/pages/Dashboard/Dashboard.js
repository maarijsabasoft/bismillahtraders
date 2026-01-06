import React, { useEffect, useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import './Dashboard.css';

const Dashboard = () => {
  const { db, isReady } = useDatabase();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalCustomers: 0,
    totalProducts: 0,
    lowStock: 0,
    todaySales: 0,
    outstandingBalance: 0
  });

  useEffect(() => {
    if (!isReady || !db) return;

    const loadStats = async () => {
      try {
        // Total Sales
        const salesResult = await db.prepare('SELECT SUM(final_amount) as total FROM sales').get();
        const totalSales = parseFloat(salesResult?.total) || 0;

        // Today's Sales
        const today = new Date().toISOString().split('T')[0];
        const todayResult = await db.prepare(`
          SELECT SUM(final_amount) as total FROM sales 
          WHERE date(sale_date) = date(?)
        `).get(today);
        const todaySales = parseFloat(todayResult?.total) || 0;

        // Total Customers
        const customersResult = await db.prepare('SELECT COUNT(*) as count FROM customers').get();
        const totalCustomers = parseInt(customersResult?.count) || 0;

        // Total Products
        const productsResult = await db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get();
        const totalProducts = parseInt(productsResult?.count) || 0;

        // Low Stock
        const lowStockResult = await db.prepare(`
          SELECT COUNT(*) as count FROM stock_levels 
          WHERE quantity <= low_stock_threshold
        `).get();
        const lowStock = parseInt(lowStockResult?.count) || 0;

        // Outstanding Balance
        const balanceResult = await db.prepare('SELECT SUM(outstanding_balance) as total FROM customers').get();
        const outstandingBalance = parseFloat(balanceResult?.total) || 0;

        setStats({
          totalSales,
          todaySales,
          totalCustomers,
          totalProducts,
          lowStock,
          outstandingBalance
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    loadStats();
  }, [db, isReady]);

  const statCards = [
    { label: "Today's Sales", value: `Rs. ${stats.todaySales.toLocaleString()}`, color: '#667eea' },
    { label: 'Total Sales', value: `Rs. ${stats.totalSales.toLocaleString()}`, color: '#388e3c' },
    { label: 'Total Customers', value: stats.totalCustomers.toString(), color: '#f57c00' },
    { label: 'Total Products', value: stats.totalProducts.toString(), color: '#7b1fa2' },
    { label: 'Low Stock Items', value: stats.lowStock.toString(), color: '#d32f2f' },
    { label: 'Outstanding Balance', value: `Rs. ${stats.outstandingBalance.toLocaleString()}`, color: '#c2185b' },
  ];

  return (
    <div className="dashboard">
      <h1 className="page-title">Dashboard</h1>
      <div className="dashboard-stats">
        {statCards.map((stat, index) => (
          <Card key={index} className="stat-card">
            <div className="stat-content">
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value" style={{ color: stat.color }}>
                {stat.value}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;

