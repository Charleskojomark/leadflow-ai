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

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    setTestResponse(null);
    try {
      const res = await api.testSmtpAccount(id);
      setTestResponse({ id, message: res.message || 'SMTP Handshake verified!', success: res.success });
    } catch (err: any) {
      setTestResponse({ id, message: err.message || 'Connection failed', success: false });
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

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSmtpAccount(formData);
      setShowModal(false);
      loadAccounts();
    } catch (err: any) {
      alert(`Error creating SMTP account: ${err.message || 'Failed'}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#06090e]">
      <Navbar
        title="SMTP & Email Infrastructure"
        subtitle="Manage sender mailboxes with Fernet encryption, TLS verification and daily send throttle"
      />

      <main className="flex-1 p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Configured Inboxes</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {accounts.length} Total
            </span>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect SMTP Account</span>
          </button>
        </div>

        {/* Security Banner */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-200">Fernet 256-bit Credential Encryption Active</p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Passwords and SMTP credentials are encrypted before persisting to the database.
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
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-white">{acc.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-800 text-slate-300 border border-slate-700">
                              {acc.provider}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{acc.from_email}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteAccount(acc.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Delete Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Host details */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
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
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing SMTP Handshake...</span>
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
                        className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                          testResponse.success
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        }`}
                      >
                        {testResponse.success ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                        )}
                        <span>{testResponse.message}</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="glass-panel w-full max-w-xl p-6 rounded-2xl space-y-5 border border-slate-700 relative my-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  <span>Connect SMTP Sending Mailbox</span>
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Presets */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Provider Preset
                </label>
                <div className="grid grid-cols-3 gap-2">
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

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Account Label *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Sales Inbound Mailer"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">SMTP Host *</label>
                    <input
                      type="text"
                      required
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                      placeholder="587"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      SMTP Username / Email *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
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

                <div className="grid grid-cols-2 gap-3 pt-1">
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

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 cursor-pointer"
                  >
                    Save & Connect Mailbox
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
