import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FiHome, FiPackage, FiShoppingCart, FiUsers, 
  FiFileText, FiBarChart2, FiUser, FiDollarSign,
  FiTruck, FiLayers, FiX
} from 'react-icons/fi';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const menuItems = [
    { path: '/dashboard', icon: FiHome, label: 'Dashboard' },
    { path: '/companies', icon: FiLayers, label: 'Companies' },
    { path: '/products', icon: FiPackage, label: 'Products' },
    { path: '/inventory', icon: FiTruck, label: 'Inventory' },
    { path: '/customers', icon: FiUsers, label: 'Customers' },
    { path: '/suppliers', icon: FiUsers, label: 'Suppliers' },
    { path: '/sales', icon: FiShoppingCart, label: 'Sales' },
    { path: '/invoices', icon: FiFileText, label: 'Invoices' },
    { path: '/reports', icon: FiBarChart2, label: 'Reports' },
    { path: '/staff', icon: FiUser, label: 'Staff' },
    { path: '/expenses', icon: FiDollarSign, label: 'Expenses' },
  ];

  const handleNavClick = () => {
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="sidebar-logo">Bismillah Traders</h1>
          <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
            <FiX />
          </button>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `sidebar-item ${isActive ? 'active' : ''}`
                }
              >
                <Icon className="sidebar-icon" />
                <span className="sidebar-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;

