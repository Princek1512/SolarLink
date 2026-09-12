import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import api from './services/api';

import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Marketplace from './pages/Marketplace';
import Trades from './pages/Trades';
import Listings from './pages/Listings';
import Settlement from './pages/Settlement';
import Disputes from './pages/Disputes';
import Audit from './pages/Audit';
import AdminSettings from './pages/AdminSettings';
import AdminRequests from './pages/AdminRequests';
import AdminDashboard from './pages/AdminDashboard';
import AdminAudit from './pages/AdminAudit';
import AdminTrades from './pages/AdminTrades';

function ProtectedRoute({ children, allowedRoles }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api.getMe()
      .then(res => {
        setUser(res);
        setLoading(false);
      })
      .catch(() => {
        navigate('/login', { state: { from: location } });
      });
  }, [navigate, location]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <Navbar user={user} />
      <div className="container my-8">
        {React.cloneElement(children, { user })}
      </div>
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/marketplace" element={
        <ProtectedRoute>
          <Marketplace />
        </ProtectedRoute>
      } />

      <Route path="/listings" element={
        <ProtectedRoute allowedRoles={['prosumer']}>
          <Listings />
        </ProtectedRoute>
      } />

      <Route path="/trades" element={
        <ProtectedRoute allowedRoles={['prosumer', 'consumer', 'admin']}>
          <Trades />
        </ProtectedRoute>
      } />

      <Route path="/trades/:id/settlement" element={
        <ProtectedRoute allowedRoles={['prosumer', 'consumer', 'admin']}>
          <Settlement />
        </ProtectedRoute>
      } />

      <Route path="/disputes" element={
        <ProtectedRoute allowedRoles={['admin', 'regulator', 'utility']}>
          <Disputes />
        </ProtectedRoute>
      } />

      <Route path="/audit" element={
        <ProtectedRoute allowedRoles={['admin', 'regulator', 'utility']}>
          <Audit />
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute allowedRoles={['admin', 'regulator', 'utility']}>
          <AdminSettings />
        </ProtectedRoute>
      } />

      <Route path="/admin/dashboard" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      <Route path="/admin/requests" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminRequests />
        </ProtectedRoute>
      } />

      <Route path="/admin/audit" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminAudit />
        </ProtectedRoute>
      } />

      <Route path="/admin/trades" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminTrades />
        </ProtectedRoute>
      } />
      
    </Routes>
  );
}

export default App;
