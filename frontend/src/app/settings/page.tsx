'use client';

import React, { useEffect, useState } from 'react';
import {
  Server,
  Database,
  Lock,
  Code2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Layers,
  Shield,
  Zap,
  Globe,
  Mail,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';

export default function SettingsPage() {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [initializingDb, setInitializingDb] = useState(false);
  const [initResult, setInitResult] = useState<{ success: boolean; message: string } | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const [healthRes, dbRes] = await Promise.all([
        fetch('/api/health').then((r) => r.json()).catch(() => ({ status: 'offline' })),
        fetch('/api/v1/database').then((r) => r.json()).catch(() => ({ status: 'unconfigured' })),
      ]);
      setHealthStatus(healthRes);
      setDbStatus(dbRes);
    } catch {
      setHealthStatus({ status: 'offline', error: 'Serverless functions unreachable' });
    } finally {
      setLoading(false);
    }
  };

  const handleInitDatabase = async () => {
    setInitializingDb(true);
    setInitResult(null);
    try {
      const res = await fetch('/api/v1/database', { method: 'POST' });
      const data = await res.json();
      setInitResult(data);
      await checkHealth();
    } catch (err: any) {
      setInitResult({ success: false, message: err.message || 'Initialization failed' });
    } finally {
      setInitializingDb(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[#06090e]">
      <Navbar
        title="Settings & System Diagnostics"
        subtitle="Platform infrastructure, Neon PostgreSQL database, and serverless runtime status"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Neon PostgreSQL Connection Panel */}
        <div className="glass-panel p-6 rounded-2xl space-y-5 border border-slate-800">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Database className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Neon PostgreSQL Database</h3>
              </div>
              <p className="text-xs text-slate-400">
                Serverless relational storage for real leads, contacts, campaigns, suppression rules, and delivery logs.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleInitDatabase}
                disabled={initializingDb}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${initializingDb ? 'animate-spin' : ''}`} />
                <span>{initializingDb ? 'Creating Tables...' : 'Initialize Schema'}</span>
              </button>

              <button
                onClick={checkHealth}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>

          {/* Database Alert / Notice */}
          {initResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                initResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {initResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              )}
              <div>
                <p className="font-semibold">{initResult.success ? 'Schema Ready' : 'Database Error'}</p>
                <p className="text-xs opacity-90 mt-0.5">{initResult.message}</p>
              </div>
            </div>
          )}

          {/* Connection Details Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Connection Status</span>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    dbStatus?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="text-xs font-bold text-slate-200">
                  {dbStatus?.configured ? 'Neon Connected' : 'DATABASE_URL Pending'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {dbStatus?.database ? `DB: ${dbStatus.database}` : 'Provide Neon Connection String'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Architecture</span>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-bold text-slate-200">100% Serverless</span>
              </div>
              <p className="text-[11px] text-slate-400">Vercel Edge / Node.js 20+</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Security Vault</span>
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">AES-256-GCM</span>
              </div>
              <p className="text-[11px] text-slate-400">Encrypted Mailbox Credentials</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Delivery Engine</span>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-bold text-slate-200">Nodemailer + DNS</span>
              </div>
              <p className="text-[11px] text-slate-400">Live RFC & MX Verification</p>
            </div>
          </div>

          {!dbStatus?.configured && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1.5">
              <p className="font-semibold text-white flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-blue-400" />
                <span>How to connect your Neon Database</span>
              </p>
              <p className="text-slate-300">
                Add your Neon Postgres connection string as an environment variable in your local <code className="px-1.5 py-0.5 rounded bg-slate-900 text-blue-300 font-mono">.env.local</code> file or in your Vercel Project Settings:
              </p>
              <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-400 overflow-x-auto border border-slate-800">
                DATABASE_URL=&quot;postgres://username:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&quot;
              </div>
              <p className="text-slate-400 text-[11px]">
                Once set, click &ldquo;Initialize Schema&rdquo; above to automatically create all relational tables, indexes, and foreign keys.
              </p>
            </div>
          )}
        </div>

        {/* Real System Engine Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-400" />
              <span>Real Lead Discovery Engine</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Powered by Cheerio and Node.js fetch: autonomous company website scraper that inspects live DOM trees, extracts verified email addresses from mailto links and regex scans, resolves executive profiles, and infers tech stacks.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Zero mock data — queries live internet targets</span>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Deep Deliverability Diagnostic</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time multi-stage verification: checks RFC 5322 syntax validity, performs asynchronous DNS MX record lookups via Node dns.promises, screens against 100+ temporary burner domains, and flags role-based accounts.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>True DNS MX resolution before outreach dispatch</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
