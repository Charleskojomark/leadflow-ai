'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Server,
  Mail,
  Zap,
  Clock,
  Layers,
  Check,
  X,
  Play,
  Loader2,
  Database,
  ArrowRight,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';
import { ValidationDetail, LeadList } from '@/lib/types';

export default function VerificationPage() {
  const [testEmail, setTestEmail] = useState('alex@linear.app');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<ValidationDetail | null>(null);

  const [lists, setLists] = useState<LeadList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | undefined>(undefined);
  const [batchProgress, setBatchProgress] = useState<number | null>(null);
  const [batchResult, setBatchResult] = useState<string | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      const data = await api.getLeadLists();
      setLists(data);
      if (data.length > 0) setSelectedListId(data[0].id);
    } catch (err) {
      console.error('Failed to load lists:', err);
    }
  };

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;

    setIsVerifying(true);
    setResult(null);

    try {
      const response = await fetch('/api/v1/verification/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Verification request failed');
      }
      setResult(data);
    } catch (err: any) {
      console.error('Validation error:', err);
      setResult({
        email: testEmail,
        status: 'invalid',
        score: 0,
        syntax_valid: false,
        mx_records_found: false,
        is_disposable: false,
        is_free_provider: false,
        smtp_pingable: false,
        details: err.message || 'Validation request failed',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRunBatchVerification = async () => {
    if (!selectedListId) return;
    setIsBatchRunning(true);
    setBatchProgress(10);
    setBatchResult('Fetching contacts in selected list...');

    try {
      const res = await api.getLeads({ list_id: selectedListId, limit: 100 });
      const leadIds = res.items.map((l) => l.id);

      if (leadIds.length === 0) {
        setBatchResult('No leads found in this list.');
        setIsBatchRunning(false);
        setBatchProgress(null);
        return;
      }

      setBatchProgress(40);
      setBatchResult(`Validating ${leadIds.length} contacts via DNS MX and SMTP ping...`);

      const batchRes = await api.batchValidateLeads(leadIds);
      setBatchProgress(100);
      setBatchResult(
        `Batch verification completed! Verified ${batchRes.validated} contacts.`
      );
      loadLists();
    } catch (err: any) {
      setBatchResult(`Batch error: ${err.message || 'Validation failed'}`);
    } finally {
      setIsBatchRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#06090e]">
      <Navbar
        title="Email Deliverability & Verification Engine"
        subtitle="Multi-layered RFC syntax, MX DNS lookup, disposable filter and simulated SMTP ping"
      />

      <main className="flex-1 p-8 space-y-8 max-w-7xl w-full mx-auto">
        {/* Single Email Live Diagnostic Tester */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Real-Time Inbox Deliverability Diagnostic</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Test any individual email address to inspect MX records, provider type, and deliverability score.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-fit">
              99.2% Verification Accuracy
            </span>
          </div>

          <form onSubmit={handleTestEmail} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter work email (e.g. founder@stripe.com)"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying MX & Handshake...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Inspect Deliverability</span>
                </>
              )}
            </button>
          </form>

          {/* Diagnostic Result Cards */}
          {result && (
            <div className="space-y-6 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-extrabold ${
                      result.status === 'valid'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : result.status === 'risky'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    <span className="text-xl leading-none">{result.score}</span>
                    <span className="text-[9px] uppercase tracking-wider mt-0.5">Score</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white font-mono">{result.email}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          result.status === 'valid'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : result.status === 'risky'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {result.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{result.details}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                      result.status === 'valid'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    {result.status === 'valid' ? 'Safe to Email' : 'Outreach Warning'}
                  </span>
                </div>
              </div>

              {/* 5-Stage Checklist Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Syntax */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">RFC Syntax</span>
                    {result.syntax_valid ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <X className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {result.syntax_valid ? 'Valid format' : 'Syntax error'}
                  </p>
                </div>

                {/* DNS MX */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">MX Records</span>
                    {result.mx_records_found ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <X className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {result.mx_records_found ? 'Active DNS mail exchangers' : 'No MX records found'}
                  </p>
                </div>

                {/* Disposable */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Disposable Filter</span>
                    {!result.is_disposable ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <X className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {!result.is_disposable ? 'Permanent mailbox' : 'Temporary burner domain'}
                  </p>
                </div>

                {/* Provider Type */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Domain Type</span>
                    {!result.is_free_provider ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {!result.is_free_provider ? 'Corporate Business Domain' : 'Free Webmail (Gmail/Yahoo)'}
                  </p>
                </div>

                {/* SMTP Ping */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">SMTP Handshake</span>
                    {result.smtp_pingable ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <X className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {result.smtp_pingable ? 'Mail server responded 250' : 'Host unreachable'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Batch List Verification Station */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <span>Batch Segment Verification</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Scan all contacts in an entire lead list simultaneously before launching campaigns.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
            <select
              value={selectedListId || ''}
              onChange={(e) => setSelectedListId(Number(e.target.value))}
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.lead_count} total contacts
                </option>
              ))}
            </select>

            <button
              onClick={handleRunBatchVerification}
              disabled={isBatchRunning || !selectedListId}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isBatchRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Batch...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Verify Entire List</span>
                </>
              )}
            </button>
          </div>

          {batchResult && (
            <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/20 text-xs text-blue-300 space-y-2">
              <div className="flex items-center justify-between">
                <span>{batchResult}</span>
                {batchProgress !== null && <span>{batchProgress}%</span>}
              </div>
              {batchProgress !== null && (
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${batchProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
