import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sun, LogOut, Wallet, Shield } from 'lucide-react';
import api from '../services/api';

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (user && ['prosumer', 'consumer'].includes(user.role)) {
      api.getWallet().then(res => setBalance(res.balance)).catch(console.error);
    }
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path || (path !== '/dashboard' && path !== '/admin/dashboard' && location.pathname.startsWith(path));

  return (
    <header className="jpm-header">
      <div className="container flex items-center justify-between" style={{ minHeight: '64px' }}>
        <div className="flex items-center gap-10">
          <Link to={user?.role === 'admin' ? "/admin/dashboard" : "/dashboard"} className="flex items-center gap-2.5 logo-brand">
            <Sun size={22} color="var(--color-gold)" />
            <span className="logo-text">SolarLink</span>
          </Link>
          
          <nav className="flex items-center gap-1 nav-menu">
            {user?.role !== 'admin' && (
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>Dashboard</Link>
            )}
            
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
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {['prosumer', 'consumer'].includes(user?.role) && (
            <div className="wallet-chip">
              <Wallet size={14} color="var(--color-gold)" />
              <span>${Number(balance).toFixed(2)}</span>
            </div>
          )}
          <div className="user-badge flex items-center gap-2">
            <Shield size={13} color="#94a3b8" />
            <span className="font-semibold text-white">{user?.name}</span>
            <span className="badge-role">{user?.role}</span>
          </div>
          <button onClick={handleLogout} className="btn-logout" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <style>{`
        .jpm-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background-color: #f5f0eb;
          border-top: 3.5px solid var(--color-gold);
          border-bottom: 1px solid #e2dcd5;
          box-shadow: 0 2px 10px rgba(140, 86, 56, 0.08);
        }
        .logo-brand {
          text-decoration: none;
        }
        .logo-text {
          font-family: var(--font-heading);
          font-size: 1.45rem;
          font-weight: 700;
          color: #1c1917;
          letter-spacing: 0.02em;
        }
        .nav-link {
          text-decoration: none;
          color: #3b3b3b;
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 0.85rem;
          padding: 0.45rem 1rem;
          border-radius: 9999px;
          transition: all 0.15s ease;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .nav-link:hover {
          color: var(--color-gold);
          background-color: rgba(140, 86, 56, 0.08);
        }
        .nav-link.active {
          color: #ffffff;
          background-color: var(--color-gold);
        }
        .wallet-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.35rem 0.85rem;
          background-color: #ffffff;
          border: 1.5px solid var(--color-gold);
          border-radius: 9999px;
          font-size: 0.825rem;
          font-weight: 700;
          color: var(--color-gold);
        }
        .user-badge {
          font-size: 0.825rem;
          padding: 0.35rem 0.75rem;
          background-color: #ffffff;
          border: 1px solid #e2dcd5;
          border-radius: 9999px;
          color: #1c1917;
        }
        .badge-role {
          font-size: 0.675rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 7px;
          background-color: var(--color-gold);
          color: #ffffff;
          border-radius: 9999px;
        }
        .btn-logout {
          background: #ffffff;
          border: 1px solid #e2dcd5;
          color: #44403c;
          padding: 6px 10px;
          border-radius: 9999px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-logout:hover {
          background-color: var(--color-gold);
          color: #ffffff;
          border-color: var(--color-gold);
        }
      `}</style>
    </header>
  );
}
