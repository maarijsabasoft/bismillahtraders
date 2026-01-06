import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import { 
  FiMenu, 
  FiX, 
  FiPackage, 
  FiShoppingCart, 
  FiBarChart2, 
  FiUser, 
  FiUsers,
  FiCheckCircle,
  FiZap,
  FiDroplet,
  FiCoffee,
  FiActivity
} from 'react-icons/fi';
import './Landing.css';

const Landing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Open login modal if coming from /login route
  useEffect(() => {
    if (location.pathname === '/login') {
      setIsLoginOpen(true);
      navigate('/', { replace: true });
    }
  }, [location, navigate]);

  const handleLoginClick = () => {
    setIsLoginOpen(true);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const success = await login(username, password);
      
      if (success) {
        setIsLoginOpen(false);
        navigate('/dashboard');
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseLogin = () => {
    setIsLoginOpen(false);
    setError('');
    setUsername('');
    setPassword('');
  };

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-content">
          <div className="landing-logo">
            <h1>Bismillah Traders</h1>
          </div>
          <button 
            className="mobile-menu-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
          <nav className={`landing-nav ${mobileMenuOpen ? 'mobile-nav-open' : ''}`}>
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#products" onClick={() => setMobileMenuOpen(false)}>Products</a>
            <Button onClick={handleLoginClick} variant="primary" size="small">
              Login
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-gradient"></div>
          <div className="hero-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
          </div>
        </div>
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-badge">
                <FiActivity className="badge-icon" />
                <span>Trusted by 1000+ Businesses</span>
              </div>
              <h1 className="hero-title">
                <span className="gradient-text">BeverageHub</span>
                <br />
                Your Complete Business Solution
              </h1>
              <p className="hero-subtitle">
                Streamline your beverage business with comprehensive inventory, sales, and customer management solutions. 
                Built for modern businesses that demand efficiency and reliability.
              </p>
              <div className="hero-buttons">
                <Button onClick={handleLoginClick} size="large" variant="primary" className="hero-btn-primary">
                  <FiZap /> Login to Dashboard
                </Button>
                <Button onClick={handleLoginClick} size="large" variant="secondary" className="hero-btn-secondary">
                  Get Started Free
                </Button>
              </div>
            </div>
            <div className="hero-image">
              <div className="hero-image-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop" 
                  alt="Beverages"
                  className="hero-img"
                />
                <div className="hero-image-overlay"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <h2 className="section-title">Powerful Features</h2>
          <p className="section-subtitle">Everything you need to manage your beverage business efficiently</p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <FiPackage />
              </div>
              <div className="feature-image">
                <img 
                  src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=300&fit=crop" 
                  alt="Inventory Management"
                />
              </div>
              <h3>Inventory Management</h3>
              <p>Track stock levels, manage inventory transactions, and get low stock alerts in real-time</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FiShoppingCart />
              </div>
              <div className="feature-image">
                <img 
                  src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop" 
                  alt="Sales Management"
                />
              </div>
              <h3>Sales Management</h3>
              <p>Process sales quickly, generate professional invoices, and track customer purchases</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FiPackage />
              </div>
              <div className="feature-image">
                <img 
                  src="https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400&h=300&fit=crop" 
                  alt="Product Catalog"
                />
              </div>
              <h3>Product Catalog</h3>
              <p>Manage your beverage products with detailed information, pricing, and categorization</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FiUsers />
              </div>
              <div className="feature-image">
                <img 
                  src="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&h=300&fit=crop" 
                  alt="Customer Management"
                />
              </div>
              <h3>Customer Management</h3>
              <p>Maintain customer database, track credit limits and outstanding balances</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FiBarChart2 />
              </div>
              <div className="feature-image">
                <img 
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop" 
                  alt="Analytics & Reports"
                />
              </div>
              <h3>Analytics & Reports</h3>
              <p>Generate detailed reports on sales, profits, expenses, and business performance</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FiUser />
              </div>
              <div className="feature-image">
                <img 
                  src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&h=300&fit=crop" 
                  alt="Staff Management"
                />
              </div>
              <h3>Staff Management</h3>
              <p>Manage staff information, roles, salaries, and track attendance records</p>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="products-section">
        <div className="container">
          <h2 className="section-title">Our Product Categories</h2>
          <p className="section-subtitle">Comprehensive beverage management for all product types</p>
          <div className="products-grid">
            <div className="product-category">
              <div className="product-icon">
                <FiDroplet />
              </div>
              <div className="product-image">
                <img 
                  src="https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&h=400&fit=crop" 
                  alt="Soft Drinks"
                />
              </div>
              <h3>Soft Drinks</h3>
              <p>Carbonated beverages, fizzy drinks, and sodas</p>
            </div>
            <div className="product-category">
              <div className="product-icon">
                <FiDroplet />
              </div>
              <div className="product-image">
                <img 
                  src="https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=400&fit=crop" 
                  alt="Fruit Juices"
                />
              </div>
              <h3>Fruit Juices</h3>
              <p>Fresh and packaged fruit juices, nectars</p>
            </div>
            <div className="product-category">
              <div className="product-icon">
                <FiDroplet />
              </div>
              <div className="product-image">
                <img 
                  src="https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop" 
                  alt="Water & Hydration"
                />
              </div>
              <h3>Water & Hydration</h3>
              <p>Mineral water, energy drinks, and sports beverages</p>
            </div>
            <div className="product-category">
              <div className="product-icon">
                <FiCoffee />
              </div>
              <div className="product-image">
                <img 
                  src="https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400&h=400&fit=crop" 
                  alt="Tea & Coffee"
                />
              </div>
              <h3>Tea & Coffee</h3>
              <p>Hot beverages, instant drinks, and ready-to-drink options</p>
            </div>
            <div className="product-category">
              <div className="product-icon">
                <FiDroplet />
              </div>
              <div className="product-image">
                <img 
                  src="https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&h=400&fit=crop" 
                  alt="Energy Drinks"
                />
              </div>
              <h3>Energy Drinks</h3>
              <p>High-energy beverages, sports drinks, and performance boosters</p>
            </div>
            <div className="product-category">
              <div className="product-icon">
                <FiDroplet />
              </div>
              <div className="product-image">
                <img 
                  src="https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=400&fit=crop" 
                  alt="Dairy Beverages"
                />
              </div>
              <h3>Dairy Beverages</h3>
              <p>Milk-based drinks, smoothies, and dairy alternatives</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-background">
          <div className="cta-gradient"></div>
        </div>
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Transform Your Business?</h2>
            <p>Join thousands of businesses already using BeverageHub to streamline their operations</p>
            <Button onClick={handleLoginClick} size="large" variant="primary" className="cta-button">
              <FiZap /> Get Started Now
            </Button>
            <div className="cta-features">
              <div className="cta-feature">
                <FiCheckCircle /> No credit card required
              </div>
              <div className="cta-feature">
                <FiCheckCircle /> Free 30-day trial
              </div>
              <div className="cta-feature">
                <FiCheckCircle /> Setup in minutes
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      <Modal
        isOpen={isLoginOpen}
        onClose={handleCloseLogin}
        title="Admin Login"
        size="small"
      >
        <form onSubmit={handleLoginSubmit}>
          {error && (
            <div className="login-error-message">
              {error}
            </div>
          )}
          
          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            placeholder="Enter username"
            autoFocus
          />
          
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter password"
          />
          
          <Button 
            type="submit" 
            variant="primary" 
            size="large"
            disabled={loading}
            style={{ width: '100%', marginTop: '20px' }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
        
        <div className="login-info-modal">
          <p><strong>Default Credentials:</strong></p>
          <p>Username: <strong>admin</strong></p>
          <p>Password: <strong>admin123</strong></p>
        </div>
      </Modal>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Bismillah Traders</h4>
              <p>Premium Beverages Management System</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <a href="#features">Features</a>
              <a href="#products">Products</a>
            </div>
            <div className="footer-section">
              <h4>Contact</h4>
              <p>Email: info@farhantraders.com</p>
              <p>Phone: +92 XXX XXXXXXX</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 Bismillah Traders. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
