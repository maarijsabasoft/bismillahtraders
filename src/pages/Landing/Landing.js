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
  FiDollarSign,
  FiMapPin,
  FiBriefcase,
  FiLayers,
  FiTrendingUp,
  FiShield,
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
      await new Promise((resolve) => setTimeout(resolve, 500));

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

  const partnerCategories = [
    { title: 'Gourmet & premium lines', detail: 'Packaged foods and beverage lines from established distributors.' },
    { title: 'Cola & carbonated drinks', detail: 'Leading cola and soft-drink brands supplied to retailers and points of sale.' },
    { title: 'Juices & nectars', detail: 'Fruit juices, nectars, and related ready-to-drink products.' },
    { title: 'Water, energy & more', detail: 'Bottled water, energy drinks, and complementary beverage categories.' },
  ];

  const softwareFeatures = [
    {
      icon: <FiPackage />,
      title: 'Inventory control',
      text: 'Track stock by product and category, record movements, and reduce shortages or overstock across your beverage lines.',
    },
    {
      icon: <FiDollarSign />,
      title: 'Daily expenses',
      text: 'Log and categorise day-to-day spending so costs stay visible, consistent, and easy to review at month-end.',
    },
    {
      icon: <FiShoppingCart />,
      title: 'Sales & orders',
      text: 'Support sales workflows, customer records, and invoicing alongside your warehouse picture.',
    },
    {
      icon: <FiBarChart2 />,
      title: 'Reports & overview',
      text: 'Summaries for sales, inventory, and expenses help you decide with clarity—not guesswork.',
    },
  ];

  return (
    <div className="landing-page landing-page--pro">
      <header className="landing-header landing-header--pro">
        <div className="landing-header-content">
          <div className="landing-logo landing-logo--pro">
            <div className="landing-logo-text">
              <span className="landing-logo-title">Bismillah Traders</span>
              <span className="landing-logo-tagline">Beverages · Kabirwala</span>
            </div>
          </div>
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
          <nav className={`landing-nav landing-nav--pro ${mobileMenuOpen ? 'mobile-nav-open' : ''}`}>
            <a href="#company" onClick={() => setMobileMenuOpen(false)}>Company</a>
            <a href="#partners" onClick={() => setMobileMenuOpen(false)}>Trade</a>
            <a href="#software" onClick={() => setMobileMenuOpen(false)}>Software</a>
            <Button onClick={handleLoginClick} variant="primary" size="small">
              Staff login
            </Button>
          </nav>
        </div>
      </header>

      <section className="hero-section hero-section--pro">
        <div className="hero-background">
          <div className="hero-gradient hero-gradient--pro" />
          <div className="hero-grid-pattern" aria-hidden="true" />
        </div>
        <div className="container">
          <div className="hero-content hero-content--pro">
            <div className="hero-text">
              <div className="hero-badge hero-badge--pro">
                <FiMapPin className="badge-icon" aria-hidden="true" />
                <span>Kabirwala, District Khanewal, Pakistan</span>
              </div>
              <h1 className="hero-title hero-title--pro">
                Wholesale beverage distribution,
                <span className="hero-title-accent"> managed with discipline.</span>
              </h1>
              <p className="hero-subtitle hero-subtitle--pro">
                Bismillah Traders serves the trade with products from trusted agencies—Gourmet lines, cola and soft drinks,
                juices, and other beverages. This application supports the business with structured inventory management
                and efficient handling of daily expenses.
              </p>
              <div className="hero-trust-row">
                <div className="hero-trust-item">
                  <FiShield aria-hidden="true" />
                  <span>Family-run operation</span>
                </div>
                <div className="hero-trust-item">
                  <FiBriefcase aria-hidden="true" />
                  <span>Built for real trade volumes</span>
                </div>
                <div className="hero-trust-item">
                  <FiLayers aria-hidden="true" />
                  <span>Inventory &amp; expenses in one place</span>
                </div>
              </div>
              <div className="hero-buttons">
                <Button
                  onClick={handleLoginClick}
                  size="large"
                  variant="primary"
                  className="hero-btn-primary hero-btn-primary--pro"
                >
                  Open management system
                </Button>
                <Button
                  type="button"
                  onClick={() => document.getElementById('software')?.scrollIntoView({ behavior: 'smooth' })}
                  size="large"
                  variant="secondary"
                  className="hero-btn-secondary hero-btn-secondary--pro"
                >
                  View capabilities
                </Button>
              </div>
            </div>
            <div className="hero-aside">
              <div className="hero-panel">
                <p className="hero-panel-label">At a glance</p>
                <ul className="hero-panel-list">
                  <li><strong>Focus</strong> — Beverage wholesale &amp; agency lines</li>
                  <li><strong>Location</strong> — Kabirwala (Khanewal)</li>
                  <li><strong>System</strong> — Stock, sales context, and expense tracking</li>
                </ul>
                <div className="hero-panel-stat">
                  <FiTrendingUp aria-hidden="true" />
                  <div>
                    <span className="hero-panel-stat-title">Operational clarity</span>
                    <span className="hero-panel-stat-sub">Fewer surprises in stock and cash outflow</span>
                  </div>
                </div>
              </div>
              <div className="hero-image hero-image--pro">
                <div className="hero-image-wrapper">
                  <img
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&h=640&fit=crop"
                    alt="Organised beverage warehouse shelving"
                    className="hero-img"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="company" className="company-section">
        <div className="container">
          <div className="section-heading">
            <h2 className="section-title section-title--pro">Company</h2>
            <p className="section-subtitle section-subtitle--pro">
              An established name in the beverage trade, rooted in Kabirwala and focused on dependable supply and sound administration.
            </p>
          </div>
          <div className="leadership-grid">
            <article className="leader-card">
              <div className="leader-card-accent" aria-hidden="true" />
              <div className="leader-initials" aria-hidden="true">MB</div>
              <h3 className="leader-name">Malik Bashir</h3>
              <p className="leader-role">Proprietor &amp; lead oversight</p>
              <p className="leader-bio">
                Guides strategy, agency relationships, and the long-term direction of Bismillah Traders in the regional beverage market.
              </p>
            </article>
            <article className="leader-card">
              <div className="leader-card-accent" aria-hidden="true" />
              <div className="leader-initials" aria-hidden="true">MFB</div>
              <h3 className="leader-name">Malik Farhan Bashir</h3>
              <p className="leader-role">Management &amp; operations</p>
              <p className="leader-bio">
                Works alongside Malik Bashir on day-to-day trade, customer service, and the systems that keep inventory and expenses under control.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="partners" className="partners-section-pro">
        <div className="container">
          <div className="section-heading">
            <h2 className="section-title section-title--pro">Trade &amp; agencies</h2>
            <p className="section-subtitle section-subtitle--pro">
              The business engages multiple agencies and product streams—so shelves stay stocked and customers served across categories.
            </p>
          </div>
          <div className="partners-grid-pro">
            {partnerCategories.map((item) => (
              <article key={item.title} className="partner-card-pro">
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="software" className="features-section features-section--pro">
        <div className="container">
          <div className="section-heading">
            <h2 className="section-title section-title--pro">Management software</h2>
            <p className="section-subtitle section-subtitle--pro">
              Purpose-built for Bismillah Traders: keep inventory accurate and daily expenses under a clear, auditable routine.
            </p>
          </div>
          <div className="features-grid features-grid--pro">
            {softwareFeatures.map((f) => (
              <div key={f.title} className="feature-card feature-card--pro">
                <div className="feature-icon feature-icon--pro">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section cta-section--pro">
        <div className="cta-background">
          <div className="cta-gradient cta-gradient--pro" />
        </div>
        <div className="container">
          <div className="cta-content">
            <h2>Authorised staff</h2>
            <p>
              Sign in to record stock movements, expenses, and sales-related data. Access is restricted to the business team.
            </p>
            <Button onClick={handleLoginClick} size="large" variant="primary" className="cta-button cta-button--pro">
              Sign in to dashboard
            </Button>
          </div>
        </div>
      </section>

      <Modal isOpen={isLoginOpen} onClose={handleCloseLogin} title="Staff login" size="small">
        <form onSubmit={handleLoginSubmit}>
          {error && <div className="login-error-message">{error}</div>}

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
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="login-info-modal">
          <p><strong>Default credentials (development)</strong></p>
          <p>Username: <strong>admin</strong></p>
          <p>Password: <strong>admin123</strong></p>
        </div>
      </Modal>

      <footer className="landing-footer landing-footer--pro">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Bismillah Traders</h4>
              <p>Beverage distribution · Kabirwala, District Khanewal, Pakistan</p>
              <p className="footer-owners">Malik Bashir · Malik Farhan Bashir</p>
            </div>
            <div className="footer-section">
              <h4>Navigate</h4>
              <a href="#company">Company</a>
              <a href="#partners">Trade</a>
              <a href="#software">Software</a>
            </div>
            <div className="footer-section">
              <h4>System</h4>
              <p>Inventory management and daily expense handling for internal use.</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} Bismillah Traders. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
