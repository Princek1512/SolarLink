import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, LogIn, UserPlus, Clock, XCircle } from 'lucide-react';
import api from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  
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
    setInfoMessage('');
    
    try {
      if (isRegister) {
        await api.register(formData);
        if (['utility', 'regulator'].includes(formData.role)) {
          const roleTitle = formData.role === 'utility' ? 'Utility Company' : 'Energy Regulator';
          setInfoMessage(`Registration request submitted successfully! Your account as a ${roleTitle} is pending admin approval. You will be able to sign in once an administrator approves your account.`);
          setIsRegister(false);
          setFormData({ ...formData, password: '' });
          return;
        } else {
          // Consumer and Prosumer get logged in directly without needing approval
          const res = await api.login({ email: formData.email, password: formData.password });
          localStorage.setItem('token', res.token);
          navigate('/dashboard');
        }
      } else {
        const res = await api.login({ email: formData.email, password: formData.password });
        localStorage.setItem('token', res.token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.toString());
    }
  };

  const isRejected = error && error.toLowerCase().includes('reject');
  const isPending = error && error.toLowerCase().includes('pending');

  return (
    <div className="flex justify-center items-center" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f0eb 0%, #eae4dd 100%)' }}>
      <div className="card shadow-lg p-8" style={{ width: '100%', maxWidth: '420px', borderRadius: '8px' }}>
        <div className="text-center mb-6">
          <div 
            style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '12px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 12px', 
              background: 'linear-gradient(135deg, #1c1917 0%, #8c5638 100%)',
              boxShadow: '0 4px 12px rgba(140, 86, 56, 0.25)'
            }}
          >
            <Sun size={26} color="#ffffff" />
          </div>
          <h2 className="m-0 font-extrabold text-2xl text-slate-900">SolarLink</h2>
          <p className="text-muted text-xs mt-1">Decentralized P2P Solar Energy Trading Platform</p>
        </div>

        {infoMessage && (
          <div className="pending-box">
            <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.85rem' }}>
              <Clock size={16} />
              <span>Request Submitted</span>
            </div>
            <p className="text-xs text-muted mb-0">{infoMessage}</p>
          </div>
        )}

        {isRejected ? (
          <div className="rejection-box">
            <div className="flex items-center gap-2 mb-1" style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>
              <XCircle size={18} />
              <span>Registration Request Rejected</span>
            </div>
            <p className="text-xs text-muted mb-0">{error}</p>
          </div>
        ) : isPending ? (
          <div className="pending-box">
            <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.85rem' }}>
              <Clock size={18} />
              <span>Approval Pending</span>
            </div>
            <p className="text-xs text-muted mb-0">{error}</p>
          </div>
        ) : error ? (
          <div className="error-box">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isRegister && (
            <>
              <div>
                <label>Full Name</label>
                <input type="text" name="name" placeholder="John Doe" value={formData.name} onChange={handleChange} required />
              </div>
              
              <div>
                <label>Account Role</label>
                <select name="role" value={formData.role} onChange={handleChange} required>
                  <option value="prosumer">Rooftop Solar Owner (Prosumer)</option>
                  <option value="consumer">Nearby Consumer (Consumer)</option>
                  <option value="utility">Utility Company (Requires Approval)</option>
                  <option value="regulator">Energy Regulator (Requires Approval)</option>
                </select>
              </div>
              
              <div>
                <label>Grid Zone Location</label>
                <select name="zone_id" value={formData.zone_id} onChange={handleChange} required>
                  <option value="ZONE-1">ZONE-1 (Downtown Core)</option>
                  <option value="ZONE-2">ZONE-2 (North Suburbs)</option>
                  <option value="ZONE-3">ZONE-3 (Industrial Park)</option>
                  <option value="ZONE-4">ZONE-4 (East Coast Tech Belt)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label>Email Address</label>
            <input type="email" name="email" placeholder="user@solarlink.com" value={formData.email} onChange={handleChange} required />
          </div>

          <div>
            <label>Password</label>
            <input type="password" name="password" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
          </div>

          <button type="submit" className="btn btn-primary w-full btn-lg mt-2">
            {isRegister ? <><UserPlus size={16} /> Create Account</> : <><LogIn size={16} /> Sign In</>}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t text-xs">
          <button 
            type="button" 
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
              setInfoMessage('');
            }}
            className="text-primary font-semibold hover:underline bg-transparent border-0 cursor-pointer"
          >
            {isRegister ? 'Already registered? Sign in here' : "Don't have an account? Register now"}
          </button>
        </div>
      </div>
    </div>
  );
}
