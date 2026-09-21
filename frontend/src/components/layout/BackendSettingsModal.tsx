// src/components/layout/BackendSettingsModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Server, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, HelpCircle, ShieldCheck } from 'lucide-react';
import { getBackendUrl, setBackendUrl, isMixedContentUrl } from '../../utils/apiConfig';
import { useAppContext } from '../../store/AppContext';

interface BackendSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackendSettingsModal({ isOpen, onClose }: BackendSettingsModalProps) {
  const { state, dispatch } = useAppContext();
  const [inputUrl, setInputUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputUrl(getBackendUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const hasMixedContentWarning = isHttps && inputUrl.startsWith('http://');

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const targetUrl = inputUrl.trim().replace(/\/$/, '');

    try {
      const res = await fetch(`${targetUrl}/health`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setTestResult({
          ok: true,
          message: `Connected successfully! Model: ${data?.model || 'YOLOv8'}`,
        });
        dispatch({ type: 'SET_BACKEND_ONLINE', payload: true });
      } else {
        setTestResult({
          ok: false,
          message: `Server responded with HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      if (hasMixedContentWarning) {
        setTestResult({
          ok: false,
          message: 'Blocked by browser (Mixed Content). HTTPS sites cannot call unencrypted http:// endpoints. Use an HTTPS URL (e.g. ngrok or Render).',
        });
      } else {
        setTestResult({
          ok: false,
          message: err?.message || 'Could not connect to server. Ensure FastAPI backend is running.',
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setBackendUrl(inputUrl.trim());
    onClose();
  };

  const handleResetToDefault = () => {
    setInputUrl('http://localhost:8000');
    setBackendUrl('http://localhost:8000');
    setTestResult(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 12, 20, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.3)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fafafa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: state.backendOnline ? '#f0fdf4' : '#eff6ff',
                color: state.backendOnline ? '#16a34a' : '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Server size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                Backend Connectivity Settings
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                Configure FastAPI inference server endpoint
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: 6,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status Alert */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: state.backendOnline ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${state.backendOnline ? '#bbf7d0' : '#fde68a'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: state.backendOnline ? '#16a34a' : '#d97706',
                }}
              />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: state.backendOnline ? '#166534' : '#92400e' }}>
                {state.backendOnline ? 'Live Backend Connected' : 'Backend Standby (Autonomous Simulation Active)'}
              </span>
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                color: '#64748b',
                background: '#ffffff',
                padding: '2px 8px',
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              {state.backendOnline ? 'Production ML' : 'Client Simulation'}
            </span>
          </div>

          {/* Explanation for Vercel Mixed Content */}
          {hasMixedContentWarning && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                fontSize: '0.75rem',
                color: '#991b1b',
                lineHeight: 1.4,
              }}
            >
              <strong>HTTPS Notice (Mixed Content):</strong> You are accessing this site via HTTPS on Vercel. Web browsers will block direct requests to <code>http://localhost:8000</code>.
              <div style={{ marginTop: 6 }}>
                To connect your local backend to Vercel, expose it with an HTTPS tunnel:
                <div
                  style={{
                    background: '#1e293b',
                    color: '#e2e8f0',
                    padding: '6px 10px',
                    borderRadius: 6,
                    marginTop: 4,
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                  }}
                >
                  npx localtunnel --port 8000
                </div>
                Then paste the generated <code>https://...</code> URL below.
              </div>
            </div>
          )}

          {/* URL Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              API Base URL
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://your-api.onrender.com or http://localhost:8000"
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: testing ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshCw size={14} style={{ animation: testing ? 'spin 1s linear infinite' : 'none' }} />
                <span>{testing ? 'Testing...' : 'Test'}</span>
              </button>
            </div>
          </div>

          {/* Test Feedback */}
          {testResult && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                background: testResult.ok ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${testResult.ok ? '#bbf7d0' : '#fecaca'}`,
                color: testResult.ok ? '#166534' : '#991b1b',
              }}
            >
              {testResult.ok ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Simulation Feature Badge */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <ShieldCheck size={18} color="#0284c7" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: '0.73rem', color: '#475569', lineHeight: 1.4 }}>
              <strong>Autonomous Demonstration Engine:</strong> When the backend server is offline, Aqua Sentinel automatically activates its internal simulation engine. You can upload sonar batches, start missions, and explore tactical clustering without any external servers.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fafafa',
          }}
        >
          <button
            type="button"
            onClick={handleResetToDefault}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '0.72rem',
              color: '#64748b',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset to localhost:8000
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '7px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#0f172a',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
