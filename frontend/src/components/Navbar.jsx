import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sun, LogOut, Wallet } from 'lucide-react';
import api from '../services/api';

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      api.getWallet().then(res => setBalance(res.balance)).catch(console.error);
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <nav style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
      <div className="container flex items-center justify-between" style={{ minHeight: '70px' }}>
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-2" style={{ textDecoration: 'none', color: 'var(--color-text-primary)' }}>
            <Sun size={24} color="var(--color-secondary)" />
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600 }}>SolarLink</span>
          </Link>
          
          <div className="flex gap-4">
            <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>Dashboard</Link>
            
            {['prosumer', 'consumer'].includes(user?.role) && (
              <>
                <Link to="/marketplace" className={`nav-link ${isActive('/marketplace') ? 'active' : ''}`}>Marketplace</Link>
                <Link to="/trades" className={`nav-link ${isActive('/trades') ? 'active' : ''}`}>My Trades</Link>
              </>
            )}

            {['admin', 'regulator', 'utility'].includes(user?.role) && (
              <>
                {user?.role === 'admin' && (
                  <>
                    <Link to="/admin/dashboard" className={`nav-link ${isActive('/admin/dashboard') ? 'active' : ''}`}>Dashboard</Link>
                    <Link to="/admin/requests" className={`nav-link ${isActive('/admin/requests') ? 'active' : ''}`}>Requests</Link>
                    <Link to="/admin/trades" className={`nav-link ${isActive('/admin/trades') ? 'active' : ''}`}>Trades</Link>
                    <Link to="/admin/audit" className={`nav-link ${isActive('/admin/audit') ? 'active' : ''}`}>Audit</Link>
                  </>
                )}
                <Link to="/disputes" className={`nav-link ${isActive('/disputes') ? 'active' : ''}`}>Disputes</Link>
                <Link to="/settings" className={`nav-link ${isActive('/settings') ? 'active' : ''}`}>Platform Setup</Link>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {user?.role !== 'admin' && (
            <div className="flex items-center gap-2 text-sm font-bold">
              <Wallet size={16} />
              ${Number(balance).toFixed(2)}
            </div>
          )}
          <div className="text-sm text-muted">
            {user?.name} ({user?.role})
          </div>
          <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '0.25rem 0.75rem', borderRadius: '4px' }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
      <style>{`
        .nav-link {
          text-decoration: none;
          color: var(--color-text-secondary);
          font-weight: 500;
          font-size: 0.95rem;
          padding: 0.5rem 0;
          border-bottom: 2px solid transparent;
        }
        .nav-link:hover { color: var(--color-text-primary); }
        .nav-link.active {
          color: var(--color-text-primary);
          border-bottom-color: var(--color-secondary);
        }
      `}</style>
    </nav>
  );
}
