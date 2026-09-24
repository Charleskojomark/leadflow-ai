'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Database,
  Lock,
  ExternalLink,
  CheckCircle2,
  Code2,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';

export default function SettingsPage() {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      setHealthStatus({ status: 'offline', error: 'Backend unreachable' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-[#06090e]">
      <Navbar
        title="Settings & System Diagnostics"
        subtitle="Platform infrastructure, security configurations, and API documentation"
      />

      <main className="flex-1 p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* System Diagnostics & Backend Health */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-400" />
                <span>Backend API & Engine Status</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                FastAPI microservice running asynchronous lead extraction, email verification, and SMTP dispatch.
              </p>
            </div>

            <button
              onClick={checkHealth}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Ping Engine</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">API Gateway</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200">FastAPI v0.115+</span>
              </div>
              <p className="text-[11px] text-slate-400">Port 8000 (Async IO)</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Database Layer</span>
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-bold text-slate-200">SQLite + Async WAL</span>
              </div>
              <p className="text-[11px] text-slate-400">Aiosqlite & SQLAlchemy 2.0</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Security / Vault</span>
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">Fernet AES-256</span>
              </div>
              <p className="text-[11px] text-slate-400">Encrypted SMTP Vault</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Frontend Runtime</span>
              <div className="flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-bold text-slate-200">Next.js 16 + React 19</span>
              </div>
              <p className="text-[11px] text-slate-400">Tailwind CSS v4 Engine</p>
            </div>
          </div>
        </div>

        {/* OpenAPI Interactive Documentation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6 rounded-2xl space-y-4 glow-card">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  <span>Swagger OpenAPI Documentation</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Explore and test all interactive REST endpoints directly in the browser via Swagger UI.
                </p>
              </div>
            </div>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Open Swagger UI (/docs)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-4 glow-card">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>ReDoc API Reference</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Clean, human-readable API documentation with schemas, request payloads, and status codes.
                </p>
              </div>
            </div>
            <a
              href="http://localhost:8000/redoc"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-purple-400 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Open ReDoc (/redoc)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
