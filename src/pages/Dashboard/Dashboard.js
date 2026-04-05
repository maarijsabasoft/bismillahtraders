import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useListCache } from '../../context/ListCacheContext';
import { LIST_CACHE_KEYS } from '../../context/listCacheKeys';
import Card from '../../components/Card/Card';
import './Dashboard.css';

const DEFAULT_DASHBOARD_STATS = {
  totalSales: 0,
  totalCustomers: 0,
  totalProducts: 0,
  lowStock: 0,
  todaySales: 0,
  outstandingBalance: 0,
  salesByDay: [],
};

const REFRESH_MS = 60_000;

function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildLast7DaysSalesByDay(trendRows) {
  const map = new Map(
    (trendRows || []).map((r) => [String(r.day), Number(r.total) || 0])
  );
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    out.push({ day: key, total: map.get(key) ?? 0 });
  }
  return out;
}

const Dashboard = () => {
  const { db, isReady, dataRevision } = useDatabase();
  const { readListCache, writeListCache } = useListCache();
  const [stats, setStats] = useState(() => {
    const c = readListCache(LIST_CACHE_KEYS.dashboardStats);
    if (c && typeof c === 'object') {
      return {
        ...DEFAULT_DASHBOARD_STATS,
        ...c,
        salesByDay: Array.isArray(c.salesByDay) ? c.salesByDay : [],
      };
    }
    return { ...DEFAULT_DASHBOARD_STATS };
  });
  const [lastUpdated, setLastUpdated] = useState(null);
  const loadStatsRef = useRef(async () => {});

  useEffect(() => {
    writeListCache(LIST_CACHE_KEYS.dashboardStats, stats);
  }, [stats, writeListCache]);

  const loadStats = useCallback(async () => {
    if (!db || !isReady) return;

    const applyPayload = (payload) => {
      setStats({
        totalSales: Number(payload.totalSales) || 0,
        todaySales: Number(payload.todaySales) || 0,
        totalCustomers: Number(payload.totalCustomers) || 0,
        totalProducts: Number(payload.totalProducts) || 0,
        lowStock: Number(payload.lowStock) || 0,
        outstandingBalance: Number(payload.outstandingBalance) || 0,
        salesByDay: Array.isArray(payload.salesByDay) ? payload.salesByDay : [],
      });
      setLastUpdated(new Date());
    };

    const loadLocalFallback = async () => {
      const td = new Date();
      const today = localDateKey(td);
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
          WHERE strftime('%Y-%m-%d', sale_date, 'localtime') = ?
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

      let salesByDay = [];
      try {
        const trendRows = await db
          .prepare(`
          SELECT strftime('%Y-%m-%d', sale_date, 'localtime') as day,
                 COALESCE(SUM(final_amount), 0) as total
          FROM sales
          GROUP BY strftime('%Y-%m-%d', sale_date, 'localtime')
        `)
          .all();
        salesByDay = buildLast7DaysSalesByDay(trendRows);
      } catch (e) {
        console.warn('Dashboard: 7-day trend query failed', e);
      }

      applyPayload({
        totalSales: parseFloat(salesResult?.total) || 0,
        todaySales: parseFloat(todayResult?.total) || 0,
        totalCustomers: parseInt(customersResult?.count, 10) || 0,
        totalProducts: parseInt(productsResult?.count, 10) || 0,
        lowStock: parseInt(lowStockResult?.count, 10) || 0,
        outstandingBalance: parseFloat(balanceResult?.total) || 0,
        salesByDay,
      });
    };

    try {
      if (typeof db.getDashboardStats === 'function') {
        try {
          const s = await db.getDashboardStats();
          if (s != null && typeof s === 'object') {
            applyPayload(s);
            return;
          }
        } catch (e) {
          console.warn('Dashboard: getDashboardStats failed, using SQL fallback', e);
        }
      }
      await loadLocalFallback();
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  }, [db, isReady]);

  loadStatsRef.current = loadStats;

  useEffect(() => {
    if (!isReady || !db) return;
    loadStats();
  }, [db, isReady, dataRevision, loadStats]);

  useEffect(() => {
    if (!isReady || !db) return;
    const id = setInterval(() => loadStatsRef.current?.(), REFRESH_MS);
    return () => clearInterval(id);
  }, [isReady, db]);

  const statCards = [
    { label: "Today's Sales", value: `Rs. ${stats.todaySales.toLocaleString()}`, color: '#123056' },
    { label: 'Total Sales', value: `Rs. ${stats.totalSales.toLocaleString()}`, color: '#15803d' },
    { label: 'Total Customers', value: stats.totalCustomers.toString(), color: '#b45309' },
    { label: 'Total Products', value: stats.totalProducts.toString(), color: '#b8892a' },
    { label: 'Low Stock Items', value: stats.lowStock.toString(), color: '#b91c1c' },
    { label: 'Outstanding Balance', value: `Rs. ${stats.outstandingBalance.toLocaleString()}`, color: '#9d174d' },
  ];

  const salesByDay = stats.salesByDay || [];
  const maxDay = Math.max(...salesByDay.map((d) => Number(d.total) || 0), 1);

  return (
    <div className="dashboard">
      <div className="dashboard-header-row">
        <h1 className="page-title">Dashboard</h1>
        {lastUpdated && (
          <span className="dashboard-updated">
            Updated {lastUpdated.toLocaleTimeString()} · auto-refresh every{' '}
            {REFRESH_MS / 1000}s
          </span>
        )}
      </div>

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

      {salesByDay.length > 0 && (
        <Card className="dashboard-chart-card">
          <h2 className="dashboard-chart-title">Sales last 7 days (Rs.)</h2>
          <div className="dashboard-bars" aria-label="Sales by day chart">
            {salesByDay.map(({ day, total }) => {
              const t = Number(total) || 0;
              const h = Math.round((t / maxDay) * 100);
              return (
                <div key={day} className="dashboard-bar-col">
                  <div className="dashboard-bar-track">
                    <div
                      className="dashboard-bar-fill"
                      style={{ height: `${h}%` }}
                      title={`${day}: Rs. ${t.toLocaleString()}`}
                    />
                  </div>
                  <span className="dashboard-bar-day">{day.slice(8)}</span>
                  <span className="dashboard-bar-val">{t >= 1000 ? `${(t / 1000).toFixed(1)}k` : t}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <p className="dashboard-print-hint no-print">
        Tip: Use <kbd>Ctrl</kbd>+<kbd>P</kbd> on Invoices (A4 / slip) for clean print layouts.
      </p>
    </div>
  );
};

export default Dashboard;
