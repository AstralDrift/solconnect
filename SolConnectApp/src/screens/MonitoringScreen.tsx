/**
 * Monitoring Screen for SolConnect
 * Provides dedicated view for system monitoring and observability
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import MonitoringDashboard from '../components/monitoring/MonitoringDashboard';

export default function MonitoringScreen(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#1e293b',
          margin: 0
        }}>
          SolConnect Monitoring
        </h1>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '14px',
            color: '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontWeight: '500'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = '#94a3b8';
            e.currentTarget.style.color = '#475569';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          ← Back
        </button>
      </div>

      {/* Dashboard */}
      <MonitoringDashboard refreshInterval={3000} />
    </div>
  );
}