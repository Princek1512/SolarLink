import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, User } from 'lucide-react';
import api from '../services/api';
import { toast } from '../utils/toast';

const STATUS_BADGE = { PENDING: 'badge-danger', APPROVED: 'badge-success', REJECTED: 'badge-neutral' };

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
    const reason = prompt('Optional: Approval note (leave blank to skip)');
    if (reason === null) return; // cancelled
    try {
      await api.approveRequest(id, reason || undefined);
      toast.success('Request approved! User account activated.');
      fetchRequests();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Reason for rejection (required):');
    if (!reason) return;
    try {
      await api.rejectRequest(id, reason);
      toast.success('Request rejected.');
      fetchRequests();
    } catch (err) {
      toast.error(err.toString());
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 style={{ margin: 0 }}>User Requests</h1>
        <div className="flex items-center gap-3">
          {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`}
            >{s || 'All'}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center p-8">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="card text-center p-8 text-muted">
          <User size={48} color="var(--color-border)" style={{ margin: '0 auto 16px' }} />
          <p>No {filter || ''} requests found.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead style={{ background: 'var(--color-bg)' }}>
                <tr>
                  {['User', 'Role', 'Zone', 'Date', 'Status', 'Reviewed By', 'Actions'].map(h => (
                    <th key={h} className="p-4 text-left text-sm font-bold" style={{ borderBottom: '2px solid var(--color-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const normalizedStatus = (r.status || '').replace(/['"]/g, '').trim().toUpperCase();
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="p-4">
                        <div className="font-bold">{r.user_name}</div>
                        <div className="text-xs text-muted">{r.user_email}</div>
                      </td>
                      <td className="p-4"><span className="badge badge-neutral">{r.role}</span></td>
                      <td className="p-4 text-sm">{r.zone_id || '—'}</td>
                      <td className="p-4 text-sm">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`badge ${STATUS_BADGE[normalizedStatus] || 'badge-neutral'}`}>
                          {normalizedStatus === 'PENDING' && <Clock size={10} className="inline mr-1" />}
                          {normalizedStatus === 'APPROVED' && <CheckCircle size={10} className="inline mr-1" />}
                          {normalizedStatus === 'REJECTED' && <XCircle size={10} className="inline mr-1" />}
                          {normalizedStatus}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        {r.reviewed_by_name ? (
                          <div>
                            <div>{r.reviewed_by_name}</div>
                            {r.review_reason && <div className="text-xs text-muted">{r.review_reason}</div>}
                            {r.reviewed_at && <div className="text-xs text-muted">{new Date(r.reviewed_at).toLocaleString()}</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-4">
                        {normalizedStatus === 'PENDING' && (
                          <div className="flex gap-2">
                            <button className="btn btn-sm btn-primary" onClick={() => handleApprove(r.id)}>
                              <CheckCircle size={12} className="inline mr-1" />Approve
                            </button>
                            <button className="btn btn-sm btn-outline" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleReject(r.id)}>
                              <XCircle size={12} className="inline mr-1" />Reject
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
        </div>
      )}
    </div>
  );
}
