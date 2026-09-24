'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  Users,
  CheckCircle2,
  MailCheck,
  Server,
  ShieldBan,
  Settings,
  Sparkles,
  Zap,
  ExternalLink,
} from 'lucide-react';

interface SidebarProps {
  apiStatus?: 'healthy' | 'offline' | 'checking';
}

export function Sidebar({ apiStatus = 'healthy' }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Lead Discovery', href: '/discovery', icon: Search, badge: 'AI' },
    { label: 'Leads & Lists', href: '/leads', icon: Users },
    { label: 'Email Validation', href: '/verification', icon: CheckCircle2 },
    { label: 'Campaigns & Drip', href: '/campaigns', icon: MailCheck },
    { label: 'SMTP Accounts', href: '/smtp', icon: Server },
    { label: 'Suppression List', href: '/suppression', icon: ShieldBan },
    { label: 'Settings & API', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col h-screen fixed left-0 top-0 z-40 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/60 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                LeadFlow
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                AI
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium -mt-0.5">Outreach Engine</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Core Platform
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-900/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors duration-200 ${
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500/30 to-indigo-500/30 text-blue-300 border border-blue-400/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Backend Status & Documentation Card */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/80">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">FastAPI Backend</span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                apiStatus === 'healthy'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  apiStatus === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              {apiStatus === 'healthy' ? 'Live' : 'Offline'}
            </span>
          </div>

          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between text-xs text-slate-400 hover:text-blue-400 transition-colors pt-1 border-t border-slate-800/60"
          >
            <span>Interactive OpenAPI Docs</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </aside>
  );
}
