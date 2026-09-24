'use client';

import React from 'react';
import { Search, Plus, Sparkles, Bell } from 'lucide-react';

interface NavbarProps {
  title: string;
  subtitle?: string;
  onQuickDiscover?: () => void;
  onQuickLead?: () => void;
  onQuickCampaign?: () => void;
}

export function Navbar({
  title,
  subtitle,
  onQuickDiscover,
  onQuickLead,
  onQuickCampaign,
}: NavbarProps) {
  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30 px-8 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Quick Global Action Buttons */}
        {onQuickDiscover && (
          <button
            onClick={onQuickDiscover}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-all duration-200 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Discovery</span>
          </button>
        )}

        {onQuickLead && (
          <button
            onClick={onQuickLead}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-colors cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Lead</span>
          </button>
        )}

        {onQuickCampaign && (
          <button
            onClick={onQuickCampaign}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-colors cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>
        )}

        {/* Demo Account Indicator */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-800 ml-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-blue-500/30">
            LF
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-200 leading-none">Admin Workspace</p>
            <p className="text-[10px] text-slate-400 leading-none mt-1">Enterprise Plan</p>
          </div>
        </div>
      </div>
    </header>
  );
}
