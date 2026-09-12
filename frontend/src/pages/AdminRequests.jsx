import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, UserCheck, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';

const STATUS_BADGE = { PENDING: 'badge-warning', APPROVED: 'badge-success', REJECTED: 'badge-danger' };

export default function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminRequests(filter || undefined);
      setRequests(data);
    } catch (err) {
      toast.error('Failed to load requests: ' + err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [filter]);

  const handleApprove = async (id) => {
    const reason = prompt('Optional approval note:');
    if (reason === null) return;
    try {
      await api.approveRequest(id, reason || undefined);
      toast.success('User registration approved & account activated!');
      fetchRequests();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      await api.rejectRequest(id, reason);
      toast.success('User registration rejected.');
      fetchRequests();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <UserCheck size={24} color="var(--color-primary)" />
            <h1 className="mb-0">User Approval Queue</h1>
          </div>
          <p className="text-sm text-muted mb-0 mt-1">Review pending prosumer & consumer account registration requests</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
            >
              {s || 'All Requests'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card text-center p-12 text-muted">Loading user request queue…</div>
      ) : requests.length === 0 ? (
        <div className="card text-center p-12 text-muted">
          <UserCheck size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
          <p className="text-base font-semibold mb-1">No {filter ? filter.toLowerCase() : ''} requests found</p>
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
                          <button className="btn btn-sm btn-approve" onClick={() => handleApprove(r.id)}>
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button className="btn btn-sm btn-reject" onClick={() => handleReject(r.id)}>
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
      )}
    </div>
  );
}
