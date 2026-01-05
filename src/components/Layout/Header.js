import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../Button/Button';
import { FiLogOut, FiMenu } from 'react-icons/fi';
import './Header.css';

const Header = ({ onMenuClick }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/landing');
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <button className="hamburger-btn" onClick={onMenuClick} aria-label="Toggle menu">
            <FiMenu />
          </button>
          <h2 className="header-title">BeverageHub</h2>
        </div>
        <div className="header-actions">
          <span className="header-date">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
          <Button
            variant="secondary"
            size="small"
            onClick={handleLogout}
            style={{ marginLeft: '16px' }}
          >
            <FiLogOut /> <span className="logout-text">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;

