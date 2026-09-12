import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, UserCheck, Wallet, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';

const STATUS_BADGE = { PENDING: 'badge-warning', APPROVED: 'badge-success', REJECTED: 'badge-danger' };

export default function AdminRequests() {
  const [activeTab, setActiveTab] = useState('deposits');
  const [requests, setRequests] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqData, depData] = await Promise.all([
        api.getAdminRequests(filter || undefined),
        api.getDeposits()
      ]);
      setRequests(reqData || []);
      setDeposits(depData || []);
    } catch (err) {
      toast.error('Failed to load request queues: ' + err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  // Handle User Registration Approval/Rejection
  const handleApproveUser = async (id) => {
    const reason = prompt('Optional approval note:');
    if (reason === null) return;
    try {
      await api.approveRequest(id, reason || undefined);
      toast.success('User registration approved & account activated!');
      fetchData();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  const handleRejectUser = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      await api.rejectRequest(id, reason);
      toast.success('User registration rejected.');
      fetchData();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  // Handle Wallet Deposit Approval/Rejection
  const handleApproveDeposit = async (id, amount, userName) => {
    if (!window.confirm(`Approve deposit of $${Number(amount).toLocaleString()} for ${userName}?`)) return;
    try {
      await api.approveDeposit(id);
      toast.success(`Deposit approved! $${Number(amount).toLocaleString()} credited to ${userName}'s wallet.`);
      fetchData();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  const handleRejectDeposit = async (id, userName) => {
    const reason = prompt(`Reason for rejecting deposit request from ${userName}:`);
    if (reason === null) return;
    try {
      await api.rejectDeposit(id, reason || 'Administrative rejection');
      toast.success('Deposit request rejected.');
      fetchData();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  const pendingUserCount = requests.filter(r => (r.status || '').toUpperCase() === 'PENDING').length;
  const pendingDepositCount = deposits.filter(d => (d.status || '').toUpperCase() === 'PENDING').length;

  const filteredDeposits = deposits.filter(d => {
    if (!filter) return true;
    return (d.status || '').toUpperCase() === filter.toUpperCase();
  });

  return (
    <div>
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <div>
          <h1 className="mb-1">Administrative Request Center</h1>
          <p className="text-sm text-muted mb-0">Review pending wallet deposits & account registration applications</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            >
              {s || 'All Statuses'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-3 mb-6 border-b pb-1">
        <button
          onClick={() => setActiveTab('deposits')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-t-lg font-bold text-sm border-b-2 bg-transparent transition-all cursor-pointer ${
            activeTab === 'deposits'
              ? 'border-[#8c5638] text-[#8c5638] bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wallet size={18} />
          <span>Wallet Deposit Requests</span>
          {pendingDepositCount > 0 && (
            <span className="badge badge-danger text-xs px-2 py-0.5 ml-1">{pendingDepositCount} Pending</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('registrations')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-t-lg font-bold text-sm border-b-2 bg-transparent transition-all cursor-pointer ${
            activeTab === 'registrations'
              ? 'border-[#8c5638] text-[#8c5638] bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck size={18} />
          <span>Account Registration Queue</span>
          {pendingUserCount > 0 && (
            <span className="badge badge-warning text-xs px-2 py-0.5 ml-1">{pendingUserCount} Pending</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="card text-center p-12 text-muted">Loading administrative requests…</div>
      ) : activeTab === 'deposits' ? (
        /* WALLET DEPOSITS VIEW */
        filteredDeposits.length === 0 ? (
          <div className="card text-center p-12 text-muted">
            <Wallet size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p className="text-base font-semibold mb-1">No {filter ? filter.toLowerCase() : ''} deposit requests found</p>
            <span className="text-xs text-muted">User wallet deposit submissions will appear here for administrative approval.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  {['User Name & Email', 'Role', 'Deposit Amount ($)', 'Request Date', 'Status', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDeposits.map(d => {
                  const normalizedStatus = (d.status || '').replace(/['"]/g, '').trim().toUpperCase();
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="font-semibold text-sm">{d.name}</div>
                        <div className="text-xs text-muted">{d.email}</div>
                      </td>
                      <td><span className="badge badge-neutral">{d.role}</span></td>
                      <td className="font-extrabold text-base text-primary">${Number(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="text-xs text-muted font-mono">{new Date(d.created_at).toLocaleString()}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[normalizedStatus] || 'badge-neutral'}`}>
                          {normalizedStatus === 'PENDING' && <Clock size={11} />}
                          {normalizedStatus === 'APPROVED' && <CheckCircle size={11} />}
                          {normalizedStatus === 'REJECTED' && <XCircle size={11} />}
                          {normalizedStatus}
                        </span>
                      </td>
                      <td>
                        {normalizedStatus === 'PENDING' && (
                          <div className="flex items-center gap-2">
                            <button className="btn btn-sm btn-approve" onClick={() => handleApproveDeposit(d.id, d.amount, d.name)}>
                              <CheckCircle size={12} /> Approve & Credit
                            </button>
                            <button className="btn btn-sm btn-reject" onClick={() => handleRejectDeposit(d.id, d.name)}>
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* USER REGISTRATIONS VIEW */
        requests.length === 0 ? (
          <div className="card text-center p-12 text-muted">
            <UserCheck size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p className="text-base font-semibold mb-1">No {filter ? filter.toLowerCase() : ''} registration requests found</p>
            <span className="text-xs text-muted">New registration requests will appear here for administrative approval.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  {['User Details', 'Requested Role', 'Grid Zone', 'Date Created', 'Status', 'Reviewer Info', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const normalizedStatus = (r.status || '').replace(/['"]/g, '').trim().toUpperCase();
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="font-semibold text-sm">{r.user_name}</div>
                        <div className="text-xs text-muted">{r.user_email}</div>
                      </td>
                      <td><span className="badge badge-neutral">{r.role}</span></td>
                      <td className="text-sm">{r.zone_id || '—'}</td>
                      <td className="text-xs text-muted font-mono">{new Date(r.created_at).toLocaleString()}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[normalizedStatus] || 'badge-neutral'}`}>
                          {normalizedStatus === 'PENDING' && <Clock size={11} />}
                          {normalizedStatus === 'APPROVED' && <CheckCircle size={11} />}
                          {normalizedStatus === 'REJECTED' && <XCircle size={11} />}
                          {normalizedStatus}
                        </span>
                      </td>
                      <td className="text-xs text-muted">
                        {r.reviewed_by_name ? (
                          <div>
                            <div className="font-semibold text-slate-700">{r.reviewed_by_name}</div>
                            {r.review_reason && <div className="text-xs">{r.review_reason}</div>}
                            {r.reviewed_at && <div className="text-xs font-mono">{new Date(r.reviewed_at).toLocaleDateString()}</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {normalizedStatus === 'PENDING' && (
                          <div className="flex items-center gap-2">
                            <button className="btn btn-sm btn-approve" onClick={() => handleApproveUser(r.id)}>
                              <CheckCircle size={12} /> Approve
                            </button>
                            <button className="btn btn-sm btn-reject" onClick={() => handleRejectUser(r.id)}>
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
