'use client';

import { useState } from 'react';

export default function InternshipAutomationAdminPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  
  // Preview State
  const [previewName, setPreviewName] = useState('HUZAIFA SIDDIQUI');
  const [previewUrl, setPreviewUrl] = useState('/api/internship/preview?name=HUZAIFA%20SIDDIQUI');

  const handleRunAutomation = async () => {
    setLoading(true);
    setStatusMsg('Connecting to Google Sheets & dispatching certificates...');
    setLogs(['[CLIENT] Initiating Internship Certificate automation...']);

    try {
      const res = await fetch('/api/internship/process', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.logs) {
        setLogs(data.logs);
      }

      if (data.success) {
        setStatusMsg(`🎉 Success: ${data.message}`);
      } else {
        setStatusMsg(`❌ Error: ${data.error || 'Failed to process certificates.'}`);
      }
    } catch (err) {
      setStatusMsg(`❌ Connection Error: ${err.message}`);
      setLogs((prev) => [...prev, `[ERROR] ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = (e) => {
    e.preventDefault();
    const encodedName = encodeURIComponent(previewName.trim() || 'HUZAIFA SIDDIQUI');
    setPreviewUrl(`/api/internship/preview?name=${encodedName}&t=${Date.now()}`);
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ marginBottom: '30px', borderBottom: '2px solid #E2E8F0', paddingBottom: '15px' }}>
        <h1 style={{ fontSize: '28px', color: '#0F172A', margin: '0 0 10px 0' }}>
          💼 Internship Completion Certificate Automation
        </h1>
        <p style={{ color: '#64748B', margin: 0 }}>
          Manage, generate, and email <strong>Internship Completion Certificates</strong> directly from Google Sheets.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        {/* Left Column: Automation Controller */}
        <div>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', color: '#1E293B', marginTop: 0 }}>🚀 Batch Execution</h2>
            <p style={{ fontSize: '14px', color: '#475569' }}>
              Reads pending intern records from Google Sheet (<code>Internship_completion</code>), overlays details onto the <code>6-Week Internship Program.png</code> template, sends email with SendGrid, and updates sheet status to <code>sent</code>.
            </p>

            <button
              onClick={handleRunAutomation}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: loading ? '#94A3B8' : '#166534',
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? '⏳ Processing Certificates...' : '🚀 Run Internship Automation'}
            </button>

            {statusMsg && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '6px', fontSize: '14px', color: '#166534' }}>
                {statusMsg}
              </div>
            )}
          </div>

          {/* Execution Logs */}
          <div style={{ background: '#0F172A', color: '#38BDF8', borderRadius: '12px', padding: '20px', fontFamily: 'monospace', fontSize: '13px', minHeight: '220px', maxHeight: '350px', overflowY: 'auto' }}>
            <div style={{ borderBottom: '1px solid #1E293B', paddingBottom: '8px', marginBottom: '12px', color: '#94A3B8', fontWeight: 'bold' }}>
              📋 Execution Terminal Logs
            </div>
            {logs.length === 0 ? (
              <div style={{ color: '#64748B' }}>Logs will appear here after starting execution...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} style={{ marginBottom: '4px', wordBreak: 'break-all' }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Live Certificate Preview */}
        <div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontSize: '20px', color: '#1E293B', marginTop: 0 }}>🖼️ Live Certificate Preview</h2>
            <p style={{ fontSize: '14px', color: '#475569' }}>
              Test font alignment and name rendering in real-time.
            </p>

            <form onSubmit={handleGeneratePreview} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                value={previewName}
                onChange={(e) => setPreviewName(e.target.value)}
                placeholder="Enter Intern Full Name"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '15px',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '10px 18px',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Render Preview
              </button>
            </form>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', background: '#F1F5F9' }}>
              <img
                src={previewUrl}
                alt="Certificate Preview"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
