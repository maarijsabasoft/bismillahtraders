import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Card from '../../components/Card/Card';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Simulate login check (in production, this would be an API call)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const success = await login(username, password);
      
      if (success) {
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

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Bismillah Traders</h1>
          <p>BeverageHub</p>
        </div>
        
        <Card className="login-card">
          <h2>Admin Login</h2>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="error-message">
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
              className="login-to-dashboard-btn"
              style={{ width: '100%', marginTop: '20px' }}
            >
              {loading ? 'Logging in...' : 'Login to Dashboard'}
            </Button>
          </form>
          
          <div className="login-info">
            <p>Default Credentials:</p>
            <p><strong>Username:</strong> admin</p>
            <p><strong>Password:</strong> admin123</p>
          </div>
        </Card>
        
        <div className="login-footer">
          <Button 
            variant="secondary" 
            onClick={() => navigate('/landing')}
          >
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;

