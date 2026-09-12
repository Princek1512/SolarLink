import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun } from 'lucide-react';
import api from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'prosumer',
    zone_id: 'ZONE-1'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      let res;
      if (isRegister) {
        await api.register(formData);
        res = await api.login({ email: formData.email, password: formData.password });
      } else {
        res = await api.login({ email: formData.email, password: formData.password });
      }
      
      localStorage.setItem('token', res.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.toString());
    }
  };

  return (
    <div className="flex justify-center items-center" style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-8">
          <Sun size={48} color="var(--color-secondary)" style={{ margin: '0 auto' }} />
          <h2 className="mt-4" style={{ marginBottom: 0 }}>SolarLink</h2>
          <p className="text-muted text-sm mt-2">Renewable Energy P2P Trading</p>
        </div>

        {error && (
          <div className="badge badge-danger w-full text-center mb-4 p-2" style={{ display: 'block', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required />
              
              <select name="role" value={formData.role} onChange={handleChange} required>
                <option value="prosumer">Prosumer (Sell Energy)</option>
                <option value="consumer">Consumer (Buy Energy)</option>
              </select>
              
              <select name="zone_id" value={formData.zone_id} onChange={handleChange} required>
                <option value="ZONE-1">ZONE-1 (Downtown)</option>
                <option value="ZONE-2">ZONE-2 (Suburbs)</option>
              </select>
            </>
          )}

          <input type="email" name="email" placeholder="Email address" value={formData.email} onChange={handleChange} required />
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-4 text-sm">
          <button 
            type="button" 
            onClick={() => setIsRegister(!isRegister)}
            style={{ background: 'none', border: 'none', color: 'var(--color-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600 }}
          >
            {isRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
