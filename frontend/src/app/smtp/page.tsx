'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Zap,
  Lock,
  Mail,
  Send,
  Loader2,
  X,
  ExternalLink,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';
import { SmtpAccount, SmtpAccountInput, SmtpProvider } from '@/lib/types';

export default function SmtpPage() {
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResponse, setTestResponse] = useState<{ id: number; message: string; success: boolean } | null>(null);

  // Modal Test State
  const [modalTesting, setModalTesting] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<{ success: boolean; message: string; code?: string } | null>(null);
  const [verifyBeforeSave, setVerifyBeforeSave] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);

  // Form State
  const [formData, setFormData] = useState<SmtpAccountInput>({
    name: 'Primary Google Workspace',
    provider: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    username: 'outreach@yourcompany.com',
    password: '',
    from_name: 'Alex Vance',
    from_email: 'outreach@yourcompany.com',
    use_tls: true,
    use_ssl: false,
    daily_limit: 300,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await api.getSmtpAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load SMTP accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (provider: SmtpProvider) => {
    setModalTestResult(null);
    if (provider === 'gmail') {
      setFormData({
        ...formData,
        provider: 'gmail',
        host: 'smtp.gmail.com',
        port: 587,
        use_tls: true,
        use_ssl: false,
      });
    } else if (provider === 'outlook') {
      setFormData({
        ...formData,
        provider: 'outlook',
        host: 'smtp.office365.com',
        port: 587,
        use_tls: true,
        use_ssl: false,
      });
    } else {
      setFormData({
        ...formData,
        provider: 'custom',
        host: 'mail.yourserver.com',
        port: 465,
        use_tls: false,
        use_ssl: true,
      });
    }
  };

  const handleTestModalConnection = async () => {
    if (!formData.host || !formData.username) {
      setModalTestResult({
        success: false,
        message: 'Please provide both SMTP Host and Username/Email before testing.',
      });
      return;
    }

    if (!formData.password) {
      setModalTestResult({
        success: false,
        message: 'Please enter your SMTP Password or App Password to test authentication.',
      });
      return;
    }

    setModalTesting(true);
    setModalTestResult(null);

    try {
      const res = await api.testSmtpCredentials(formData);
      setModalTestResult(res);
    } catch (err: any) {
      setModalTestResult({
        success: false,
        message: err.message || 'Connection test failed unexpectedly.',
      });
    } finally {
      setModalTesting(false);
    }
  };

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    setTestResponse(null);
    try {
      const res = await api.testSmtpAccount(id);
      setTestResponse({ id, message: res.message || 'SMTP Handshake verified!', success: res.success });
      // Update account status in local view
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === id
            ? {
                ...acc,
                connection_status: res.success ? 'verified' : 'failed',
                last_error: res.success ? undefined : res.message,
                last_tested_at: new Date().toISOString(),
              }
            : acc
        )
      );
    } catch (err: any) {
      setTestResponse({ id, message: err.message || 'Connection failed', success: false });
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === id
            ? {
                ...acc,
                connection_status: 'failed',
                last_error: err.message || 'Connection failed',
                last_tested_at: new Date().toISOString(),
              }
            : acc
        )
      );
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Are you sure you want to remove this SMTP account?')) return;
    try {
      await api.deleteSmtpAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent, forceSave = false) => {
    e.preventDefault();
    setSavingAccount(true);

    try {
      // If verification is enabled and we haven't verified or force-saved yet
      if (verifyBeforeSave && !forceSave && modalTestResult?.success !== true) {
        setModalTesting(true);
        const testRes = await api.testSmtpCredentials(formData);
        setModalTesting(false);
        setModalTestResult(testRes);

        if (!testRes.success) {
          // Halt save so user knows credentials failed
          setSavingAccount(false);
          return;
        }
      }

      const payload = {
        ...formData,
        connection_status: modalTestResult?.success ? ('verified' as const) : ('untested' as const),
      };

      await api.createSmtpAccount(payload);
      setShowModal(false);
      setModalTestResult(null);
      loadAccounts();
    } catch (err: any) {
      alert(`Error saving SMTP mailbox: ${err.message || 'Failed'}`);
    } finally {
      setSavingAccount(false);
      setModalTesting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#06090e]">
      <Navbar
        title="SMTP & Email Infrastructure"
        subtitle="Manage sender mailboxes with Fernet AES-256 encryption, TLS handshake verification, and send quotas"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white">Configured Inboxes</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {accounts.length} Total
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {accounts.filter((a) => a.connection_status === 'verified').length} Verified
            </span>
          </div>

          <button
            onClick={() => {
              setModalTestResult(null);
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect SMTP Mailbox</span>
          </button>
        </div>

        {/* Security Banner */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">Zero-Trust Credential Security & Handshake Validation</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                SMTP passwords are encrypted with AES-256-GCM. Live sockets verify TLS negotiation and SMTP authentication before campaign dispatch.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
            Encrypted & Protected
          </span>
        </div>

        {/* Inboxes Grid */}
        {loading ? (
          <div className="glass-panel p-12 rounded-2xl text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Loading mail accounts...</span>
          </div>
        ) : accounts.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <Server className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-300">No SMTP Inboxes Connected</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Connect your Google Workspace, Microsoft 365, or Custom SMTP mailbox to start dispatching emails.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-600/30 cursor-pointer"
            >
              Add First Mailbox
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accounts.map((acc) => {
              const usagePct =
                acc.daily_limit > 0
                  ? Math.round((acc.emails_sent_today / acc.daily_limit) * 100)
                  : 0;

              return (
                <div
                  key={acc.id}
                  className="glass-panel p-6 rounded-2xl glow-card space-y-5 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold shrink-0">
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-bold text-white">{acc.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-800 text-slate-300 border border-slate-700">
                              {acc.provider}
                            </span>

                            {/* Status Badge */}
                            {acc.connection_status === 'verified' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Verified
                              </span>
                            )}
                            {acc.connection_status === 'failed' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                                <AlertCircle className="w-2.5 h-2.5" />
                                Auth Failed
                              </span>
                            )}
                            {(!acc.connection_status || acc.connection_status === 'untested') && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Untested
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{acc.from_email}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteAccount(acc.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Delete Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Host details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Host & Port</span>
                        <span className="font-mono text-slate-300 mt-0.5 block">
                          {acc.host}:{acc.port}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Security Layer</span>
                        <span className="text-slate-300 mt-0.5 block font-medium">
                          {acc.use_tls ? 'STARTTLS (587)' : acc.use_ssl ? 'SSL/TLS (465)' : 'Plaintext'}
                        </span>
                      </div>
                    </div>

                    {/* Show error explanation if connection failed */}
                    {acc.connection_status === 'failed' && acc.last_error && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                        <div>
                          <p className="font-semibold text-rose-200">Connection Handshake Rejected</p>
                          <p className="text-[11px] text-rose-300/90 mt-0.5 leading-relaxed">{acc.last_error}</p>
                        </div>
                      </div>
                    )}

                    {/* Daily Quota Progress */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Daily Quota Usage</span>
                        <span className="text-slate-200 font-semibold">
                          {acc.emails_sent_today} / {acc.daily_limit} sent today ({usagePct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(usagePct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions & Live Connection Test */}
                  <div className="space-y-3 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => handleTestConnection(acc.id)}
                      disabled={testingId === acc.id}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      {testingId === acc.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          <span>Testing SMTP Socket & Auth...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-blue-400" />
                          <span>Test Mailbox Connection</span>
                        </>
                      )}
                    </button>

                    {testResponse && testResponse.id === acc.id && (
                      <div
                        className={`p-3 rounded-xl text-xs flex items-start gap-2 border animate-in fade-in duration-200 ${
                          testResponse.success
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        }`}
                      >
                        {testResponse.success ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                        )}
                        <span className="leading-relaxed">{testResponse.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Connect SMTP Account */}
        {showModal && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowModal(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-hidden"
          >
            <div className="glass-panel w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
              {/* Sticky Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-900/95">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  <span>Connect SMTP Sending Mailbox</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close modal (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Presets */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Provider Preset
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('gmail')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        formData.provider === 'gmail'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Google Workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('outlook')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        formData.provider === 'outlook'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Microsoft 365
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('custom')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        formData.provider === 'custom'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Custom SMTP
                    </button>
                  </div>
                </div>

                <form id="smtp-form" onSubmit={(e) => handleCreateAccount(e, false)} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Account Label *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        setModalTestResult(null);
                      }}
                      placeholder="e.g. Sales Inbound Mailer"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">SMTP Host *</label>
                      <input
                        type="text"
                        required
                        value={formData.host}
                        onChange={(e) => {
                          setFormData({ ...formData, host: e.target.value });
                          setModalTestResult(null);
                        }}
                        placeholder="smtp.gmail.com"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Port *</label>
                      <input
                        type="number"
                        required
                        value={formData.port}
                        onChange={(e) => {
                          setFormData({ ...formData, port: Number(e.target.value) });
                          setModalTestResult(null);
                        }}
                        placeholder="587"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        SMTP Username / Email *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.username}
                        onChange={(e) => {
                          setFormData({ ...formData, username: e.target.value });
                          setModalTestResult(null);
                        }}
                        placeholder="alex@company.com"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        App Password / Token *
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.password || ''}
                        onChange={(e) => {
                          setFormData({ ...formData, password: e.target.value });
                          setModalTestResult(null);
                        }}
                        placeholder="16-character App Password"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {formData.provider === 'gmail' && (
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0 text-blue-400" />
                      <span>
                        Gmail requires a <strong>16-character App Password</strong> generated from Google Account Security with 2-Step Verification enabled.
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Sender Name</label>
                      <input
                        type="text"
                        value={formData.from_name}
                        onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                        placeholder="Alex Vance"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        From Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.from_email}
                        onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                        placeholder="alex@company.com"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Daily Max Send Quota
                      </label>
                      <input
                        type="number"
                        value={formData.daily_limit}
                        onChange={(e) =>
                          setFormData({ ...formData, daily_limit: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex flex-col justify-end space-y-2 pb-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.use_tls}
                          onChange={(e) => setFormData({ ...formData, use_tls: e.target.checked })}
                          className="rounded text-blue-600 bg-slate-900 border-slate-700"
                        />
                        <span>Require STARTTLS</span>
                      </label>
                    </div>
                  </div>

                  {/* Pre-Save Handshake Verification Status */}
                  {modalTestResult && (
                    <div
                      className={`p-3.5 rounded-xl text-xs flex items-start justify-between gap-3 border animate-in fade-in duration-200 ${
                        modalTestResult.success
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {modalTestResult.success ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-200">
                            {modalTestResult.success ? 'Handshake Verified' : 'Authentication / Connection Failed'}
                          </p>
                          <p className="text-[11px] leading-relaxed opacity-90">{modalTestResult.message}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalTestResult(null)}
                        className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800/60 shrink-0 cursor-pointer"
                        title="Dismiss notification"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Verification Toggle */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={verifyBeforeSave}
                        onChange={(e) => setVerifyBeforeSave(e.target.checked)}
                        className="rounded text-blue-600 bg-slate-900 border-slate-700"
                      />
                      <span>Verify connection & credentials before saving mailbox</span>
                    </label>
                  </div>
                </form>
              </div>

              {/* Sticky Modal Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-800 bg-slate-900/95 shrink-0">
                <button
                  type="button"
                  onClick={handleTestModalConnection}
                  disabled={modalTesting || savingAccount}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {modalTesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-blue-400" />
                      <span>Test Handshake</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>

                  {modalTestResult && !modalTestResult.success && (
                    <button
                      type="button"
                      onClick={(e) => handleCreateAccount(e, true)}
                      disabled={savingAccount}
                      className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold cursor-pointer transition-colors"
                      title="Save even though handshake test failed"
                    >
                      Save Anyway
                    </button>
                  )}

                  <button
                    type="submit"
                    form="smtp-form"
                    disabled={savingAccount || modalTesting}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/30 cursor-pointer flex items-center gap-1.5 transition-all"
                  >
                    {savingAccount ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying & Saving...</span>
                      </>
                    ) : (
                      <span>Save Mailbox</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
