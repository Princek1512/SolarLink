import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('unauthorized'));
    }
    return Promise.reject(error.response?.data?.error || error.message);
  }
);

// Listen for unauthorized globally
window.addEventListener('unauthorized', () => {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
});

export default {
  // Auth
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),

  // Assets & Meters
  createAsset: (data) => api.post('/assets', data),
  createMeter: (assetId) => api.post(`/assets/${assetId}/meter`),

  getProsumerDashboard: () => api.get('/dashboard/prosumer'),
  getConsumerDashboard: () => api.get('/dashboard/consumer'),
  getRegulatorDashboard: () => api.get('/dashboard/regulator'),

  // Assets & Meters
  createAsset: (data) => api.post('/assets', data),
  createMeter: (assetId) => api.post(`/assets/${assetId}/meter`),
  simulateMeter: (meterId) => api.post(`/meters/${meterId}/simulate`),

  // Marketplace
  getListings: (zoneId) => api.get(zoneId ? `/listings?zone_id=${zoneId}` : '/listings'),
  createListing: (data) => api.post('/listings', data),
  purchaseListing: (id, data) => api.post(`/listings/${id}/purchase`, data),
  createOrder: (data) => api.post('/orders', data),

  // Trades
  getTrades: () => api.get('/trades'),
  getTrade: (id) => api.get(`/trades/${id}`),
  getTradeEvents: (id) => api.get(`/trades/${id}/events`),
  lockTrade: (id) => api.post(`/trades/${id}/lock`),
  verifyDelivery: (id, data) => api.post(`/trades/${id}/delivery/verify`, data || {}),
  progressTrade: (id) => api.post(`/trades/${id}/progress`),
  
  // Wallet
  getWallet: () => api.get('/wallet'),
  requestDeposit: (data) => api.post('/wallet/deposit', data),
  getDeposits: () => api.get('/wallet/deposits'),
  approveDeposit: (id) => api.post(`/wallet/deposits/${id}/approve`),

  // Admin & Platform Setup
  getZones: () => api.get('/zones'),
  updateZone: (id, data) => api.patch(`/zones/${id}`, data),
  updateListing: (id, data) => api.patch(`/listings/${id}`, data),
  cancelListing: (id) => api.delete(`/listings/${id}`),
  getPricingConfig: (zoneId) => api.get(`/pricing/config/${zoneId}`),
  updatePricingConfig: (zoneId, data) => api.patch(`/pricing/config/${zoneId}`, data),
  
  // Disputes
  getDisputes: () => api.get('/disputes'),
  resolveDispute: (tradeId, data) => api.post(`/disputes/${tradeId}/resolve`, data),

  // Admin APIs
  getAdminDashboard: () => api.get('/admin/dashboard'),
  getAdminRequests: (status) => api.get(`/admin/requests${status ? `?status=${status}` : ''}`),
  approveRequest: (id, reason) => api.post(`/admin/requests/${id}/approve`, { reason }),
  rejectRequest: (id, reason) => api.post(`/admin/requests/${id}/reject`, { reason }),
  getAuditLogs: (params) => api.get('/admin/audit', { params }),
  getAdminTrades: (status) => api.get(`/admin/trades${status ? `?status=${status}` : ''}`),
  getBlockchainLedger: () => api.get('/admin/blockchain'),
  getAdminUsers: () => api.get('/admin/users'),
};
