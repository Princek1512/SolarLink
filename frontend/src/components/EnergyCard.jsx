import React from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

export default function EnergyCard({ title, value, unit, icon: Icon, trendData }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-muted)', margin: 0 }}>
          {title}
        </h3>
        {Icon && <Icon size={20} color="var(--color-secondary)" />}
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 600 }}>
            {value}
          </span>
          <span className="text-muted text-sm" style={{ marginLeft: '4px' }}>
            {unit}
          </span>
        </div>
        
        {trendData && trendData.length > 0 && (
          <div style={{ width: '80px', height: '40px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--color-primary-dark)" 
                  strokeWidth={2} 
                  dot={false} 
                />
                <Tooltip content={<></>} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
