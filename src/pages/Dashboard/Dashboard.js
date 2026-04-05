import React, { useEffect, useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import Card from '../../components/Card/Card';
import './Dashboard.css';

const Dashboard = () => {
  const { db, isReady, dataRevision } = useDatabase();
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
        if (typeof db.getDashboardStats === 'function') {
          const s = await db.getDashboardStats();
          if (s != null) {
            setStats({
              totalSales: Number(s.totalSales) || 0,
              todaySales: Number(s.todaySales) || 0,
              totalCustomers: Number(s.totalCustomers) || 0,
              totalProducts: Number(s.totalProducts) || 0,
              lowStock: Number(s.lowStock) || 0,
              outstandingBalance: Number(s.outstandingBalance) || 0,
            });
            return;
          }
        }

        const today = new Date().toISOString().split('T')[0];
        const [
          salesResult,
          todayResult,
          customersResult,
          productsResult,
          lowStockResult,
          balanceResult,
        ] = await Promise.all([
          db.prepare('SELECT SUM(final_amount) as total FROM sales').get(),
          db
            .prepare(`
          SELECT SUM(final_amount) as total FROM sales 
          WHERE date(sale_date) = date(?)
        `)
            .get(today),
          db.prepare('SELECT COUNT(*) as count FROM customers').get(),
          db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get(),
          db
            .prepare(`
          SELECT COUNT(*) as count FROM stock_levels 
          WHERE quantity <= low_stock_threshold
        `)
            .get(),
          db.prepare('SELECT SUM(outstanding_balance) as total FROM customers').get(),
        ]);

        setStats({
          totalSales: parseFloat(salesResult?.total) || 0,
          todaySales: parseFloat(todayResult?.total) || 0,
          totalCustomers: parseInt(customersResult?.count, 10) || 0,
          totalProducts: parseInt(productsResult?.count, 10) || 0,
          lowStock: parseInt(lowStockResult?.count, 10) || 0,
          outstandingBalance: parseFloat(balanceResult?.total) || 0,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    loadStats();
  }, [db, isReady, dataRevision]);

  const statCards = [
    { label: "Today's Sales", value: `Rs. ${stats.todaySales.toLocaleString()}`, color: '#123056' },
    { label: 'Total Sales', value: `Rs. ${stats.totalSales.toLocaleString()}`, color: '#15803d' },
    { label: 'Total Customers', value: stats.totalCustomers.toString(), color: '#b45309' },
    { label: 'Total Products', value: stats.totalProducts.toString(), color: '#b8892a' },
    { label: 'Low Stock Items', value: stats.lowStock.toString(), color: '#b91c1c' },
    { label: 'Outstanding Balance', value: `Rs. ${stats.outstandingBalance.toLocaleString()}`, color: '#9d174d' },
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

