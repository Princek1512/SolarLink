import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Listings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Relying on the Prosumer dashboard to fetch user's active listings
    api.getProsumerDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  const activeListings = data?.listings || [];

  return (
    <div>
      <h1 className="mb-8">My Energy Listings</h1>
      
      {activeListings.length === 0 ? (
        <div className="card text-center p-8 text-muted">
          You have no active listings. Surplus will auto-list based on your smart meter.
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th className="p-4 text-left text-sm font-bold">Zone</th>
                <th className="p-4 text-left text-sm font-bold">Total Capacity</th>
                <th className="p-4 text-left text-sm font-bold">Remaining</th>
                <th className="p-4 text-left text-sm font-bold">Asking Price</th>
                <th className="p-4 text-left text-sm font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeListings.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="p-4">{l.zone_id}</td>
                  <td className="p-4">{Number(l.capacity_kwh).toFixed(2)} kWh</td>
                  <td className="p-4 font-bold">{Number(l.remaining_kwh).toFixed(2)} kWh</td>
                  <td className="p-4">${Number(l.asking_price).toFixed(2)}</td>
                  <td className="p-4"><span className="badge badge-success">{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
