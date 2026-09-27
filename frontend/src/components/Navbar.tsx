'use client';

import React from 'react';
import { Search, Plus, Sparkles, Menu } from 'lucide-react';

interface NavbarProps {
  title: string;
  subtitle?: string;
  onMobileMenuToggle?: () => void;
  onQuickDiscover?: () => void;
  onQuickLead?: () => void;
  onQuickCampaign?: () => void;
}

export function Navbar({
  title,
  subtitle,
  onMobileMenuToggle,
  onQuickDiscover,
  onQuickLead,
  onQuickCampaign,
}: NavbarProps) {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — only on mobile */}
        <button
          onClick={() => window.dispatchEvent(new Event('leadflow:toggle-mobile-menu'))}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Quick Global Action Buttons — hide labels on very small screens */}
        {onQuickDiscover && (
          <button
            onClick={onQuickDiscover}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-all duration-200 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">AI Discovery</span>
          </button>
        )}

        {onQuickLead && (
          <button
            onClick={onQuickLead}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-colors cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">New Lead</span>
          </button>
        )}

        {onQuickCampaign && (
          <button
            onClick={onQuickCampaign}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-colors cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">New Campaign</span>
          </button>
        )}

        {/* Account badge */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-800 ml-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-blue-500/30 shrink-0">
            LF
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-slate-200 leading-none">Admin Workspace</p>
            <p className="text-[10px] text-slate-400 leading-none mt-1">Enterprise Plan</p>
          </div>
        </div>
      </div>
    </header>
  );
}
