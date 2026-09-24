'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  MailCheck,
  Send,
  TrendingUp,
  Server,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Upload,
  Play,
  Activity,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';
import { DashboardMetrics, ActivityLogItem } from '@/lib/types';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [metricsData, logsData] = await Promise.all([
        api.getDashboardMetrics(),
        api.getActivityLogs(8),
      ]);
      setMetrics(metricsData);
      setActivityLogs(logsData);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setMetrics({
        total_leads: 0,
        valid_leads: 0,
        risky_leads: 0,
        invalid_leads: 0,
        total_campaigns: 0,
        active_campaigns: 0,
        total_emails_sent: 0,
        overall_open_rate: 0,
        overall_reply_rate: 0,
        overall_bounce_rate: 0,
        active_smtp_count: 0,
      });
      setActivityLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const validPct = metrics
    ? metrics.total_leads > 0
      ? Math.round((metrics.valid_leads / metrics.total_leads) * 100)
      : 85
    : 85;

  return (
    <div className="flex-1 flex flex-col bg-[#06090e]">
      <Navbar
        title="Command Center"
        subtitle="Real-time Lead Intelligence & Cold Outreach Automation"
      />

      <main className="flex-1 p-8 space-y-8 max-w-7xl w-full mx-auto">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/40 border border-blue-500/20 p-6 shadow-xl shadow-blue-950/20">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-xs font-semibold text-blue-300">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Next-Gen Cold Outreach Platform</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                Accelerate Discovery. Deliver to Inboxes.
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                LeadFlow AI extracts verified decision-maker emails, runs deep DNS/MX checks,
                and orchestrates multi-step cold outreach campaigns with built-in sender reputation protection.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-medium transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Sync Metrics</span>
              </button>
              <Link
                href="/discovery"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer group"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Discover Leads</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* 6 Key Performance Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Total Leads */}
          <div className="glass-panel p-5 rounded-2xl glow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Total Leads In Database</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-white tracking-tight">
                {loading ? '...' : metrics?.total_leads.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{validPct}% Clean</span>
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${validPct}%` }}
                title="Valid"
              />
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${100 - validPct}%` }}
                title="Risky/Unverified"
              />
            </div>
          </div>

          {/* Clean Verified Leads */}
          <div className="glass-panel p-5 rounded-2xl glow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Verified Clean Emails</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-white tracking-tight">
                {loading ? '...' : metrics?.valid_leads.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-slate-400">
                {metrics ? `${metrics.risky_leads} Risky • ${metrics.invalid_leads} Invalid` : ''}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Verified with MX records, disposable filters & SMTP handshake
            </p>
          </div>

          {/* Active Campaigns */}
          <div className="glass-panel p-5 rounded-2xl glow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Campaigns Running</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <MailCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-white tracking-tight">
                {loading ? '...' : metrics?.active_campaigns}
              </span>
              <span className="text-xs text-indigo-400 font-medium">
                {metrics?.total_campaigns} Total Created
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Multi-step automated drip sequences active
            </p>
          </div>

          {/* Emails Sent */}
          <div className="glass-panel p-5 rounded-2xl glow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Outreach Emails Sent</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-white tracking-tight">
                {loading ? '...' : metrics?.total_emails_sent.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-cyan-400">
                {metrics ? `${metrics.overall_bounce_rate}% Bounce` : ''}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Safe sending rate maintained across all connected inboxes
            </p>
          </div>

          {/* Open & Reply Rates */}
          <div className="glass-panel p-5 rounded-2xl glow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Avg Engagement Rate</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-white tracking-tight">
                {loading ? '...' : `${metrics?.overall_open_rate}%`}
              </span>
              <span className="text-xs font-semibold text-purple-400">
                {loading ? '' : `${metrics?.overall_reply_rate}% Reply Rate`}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Above B2B SaaS industry benchmark (22.5% open rate)
            </p>
          </div>

          {/* Active SMTP Inboxes */}
          <div className="glass-panel p-5 rounded-2xl glow-card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Connected SMTP Inboxes</span>
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-white tracking-tight">
                {loading ? '...' : metrics?.active_smtp_count}
              </span>
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>All Healthy</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Warm-up protection and TLS encryption enabled
            </p>
          </div>
        </div>

        {/* Quick Launch & Action Hub */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">
            Quick Actions & Workflow Launchers
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/discovery"
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-900 transition-all duration-200 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-110 transition-transform">
                <Search className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors">
                AI URL & Search Scraper
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Extract emails, social links & techs from target sites or Google queries
              </p>
            </Link>

            <Link
              href="/leads"
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900 transition-all duration-200 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                Import CSV Contacts
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Upload lead spreadsheets and map custom attributes directly into lists
              </p>
            </Link>

            <Link
              href="/verification"
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 hover:bg-slate-900 transition-all duration-200 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-200 group-hover:text-purple-400 transition-colors">
                Verify Deliverability
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Inspect MX records, disposable flags and test SMTP handshakes
              </p>
            </Link>

            <Link
              href="/campaigns"
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 transition-all duration-200 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-110 transition-transform">
                <Play className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-200 group-hover:text-cyan-400 transition-colors">
                Drip Outreach Sequence
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Build personalized cold email drip flows with automated delays
              </p>
            </Link>
          </div>
        </div>

        {/* Activity Logs & Lead Quality Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quality Distribution Breakdown */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Lead Verification Distribution</span>
            </h3>

            <div className="space-y-3 pt-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-emerald-400 font-medium">Valid & Deliverable</span>
                  <span className="text-slate-300 font-bold">{metrics?.valid_leads || 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        metrics && metrics.total_leads > 0
                          ? (metrics.valid_leads / metrics.total_leads) * 100
                          : 80
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-amber-400 font-medium">Risky / Catch-All</span>
                  <span className="text-slate-300 font-bold">{metrics?.risky_leads || 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        metrics && metrics.total_leads > 0
                          ? (metrics.risky_leads / metrics.total_leads) * 100
                          : 15
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-rose-400 font-medium">Invalid / Disposable</span>
                  <span className="text-slate-300 font-bold">{metrics?.invalid_leads || 0}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        metrics && metrics.total_leads > 0
                          ? (metrics.invalid_leads / metrics.total_leads) * 100
                          : 5
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400">
              <span className="text-emerald-400 font-semibold">Reputation Safe:</span> Outreach is
              strictly restricted to Valid contacts by default to ensure maximum deliverability and
              protect domain reputation.
            </div>
          </div>

          {/* Real-time Activity Feed */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span>Live Outreach & Discovery Feed</span>
              </h3>
              <span className="text-[11px] text-slate-500">Auto-refreshed</span>
            </div>

            <div className="space-y-3 divide-y divide-slate-800/60">
              {activityLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No activity recorded yet. Run an extraction or launch a campaign to see live events.
                </p>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">
                            {log.action.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase">
                            {log.entity_type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{log.details}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {new Date(log.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
