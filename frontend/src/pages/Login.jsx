import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, LogIn, UserPlus, Lock } from 'lucide-react';
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
    <div className="flex justify-center items-center" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f0eb 0%, #eae4dd 100%)' }}>
      <div className="card shadow-lg p-8" style={{ width: '100%', maxWidth: '420px' }}>
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md" style={{ background: 'linear-gradient(135deg, #1c1917 0%, #8c5638 100%)' }}>
            <Sun size={26} color="#ffffff" />
          </div>
          <h2 className="m-0 font-extrabold text-2xl text-slate-900">SolarLink</h2>
          <p className="text-muted text-xs mt-1">Decentralized P2P Solar Energy Trading Platform</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center mb-4">
            {error}
          </div>
        )}

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
                  <option value="utility">Utility Company</option>
                  <option value="regulator">Energy Regulator</option>
                </select>
              </div>
              
              <div>
                <label>Grid Zone Location</label>
                <select name="zone_id" value={formData.zone_id} onChange={handleChange} required>
                  <option value="ZONE-1">ZONE-1 (Downtown Core)</option>
                  <option value="ZONE-2">ZONE-2 (North Suburbs)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label>Email Address</label>
            <input type="email" name="email" placeholder="admin@solarlink.com" value={formData.email} onChange={handleChange} required />
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
            onClick={() => setIsRegister(!isRegister)}
            className="text-primary font-semibold hover:underline bg-transparent border-0 cursor-pointer"
          >
            {isRegister ? 'Already registered? Sign in here' : "Don't have an account? Register now"}
          </button>
        </div>
      </div>
    </div>
  );
}
