'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldBan,
  Plus,
  Trash2,
  ShieldCheck,
  Mail,
  Globe,
  AlertTriangle,
  X,
  Loader2,
  FileCheck,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';
import { SuppressionRule } from '@/lib/types';

export default function SuppressionPage() {
  const [rules, setRules] = useState<SuppressionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [ruleType, setRuleType] = useState<'email' | 'domain'>('domain');
  const [ruleValue, setRuleValue] = useState('');
  const [ruleReason, setRuleReason] = useState('Manual Opt-Out');

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await api.getSuppressionList();
      setRules(data);
    } catch (err) {
      console.error('Failed to load suppression rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleValue) return;

    try {
      await api.addSuppressionRule({
        rule_type: ruleType,
        value: ruleValue.toLowerCase().trim(),
        reason: ruleReason,
      });
      setShowModal(false);
      setRuleValue('');
      loadRules();
    } catch (err: any) {
      alert(`Error adding suppression rule: ${err.message || 'Failed'}`);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to remove this suppression rule?')) return;
    try {
      await api.deleteSuppressionRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#06090e]">
      <Navbar
        title="Suppression List & Compliance"
        subtitle="Protect sender score by blocking suppressed contacts, hard bounces, and competitor domains"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Suppressed Addresses & Domains</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {rules.length} Active Rules
            </span>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Suppression Rule</span>
          </button>
        </div>

        {/* Compliance Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-4 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>CAN-SPAM & GDPR Enforcement</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every dispatched email includes RFC 8058 compliant `List-Unsubscribe` headers and opt-out links.
            </p>
          </div>

          <div className="glass-panel p-4 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Automated Hard Bounce Shield</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Addresses returning SMTP 550 codes are auto-appended to the suppression list to prevent repeated attempts.
            </p>
          </div>

          <div className="glass-panel p-4 rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>Wildcard Domain Masking</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Block entire domains (e.g. `competitor.com`) to ensure internal or sensitive domains are never emailed.
            </p>
          </div>
        </div>

        {/* Suppression Rules Table */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Rule Target</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Reason</th>
                  <th className="py-3 px-4 font-semibold">Date Added</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                      <span>Loading suppression list...</span>
                    </td>
                  </tr>
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No suppression rules found. Your deliverability reputation is clean!
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                        {rule.value}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                            rule.rule_type === 'domain'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {rule.rule_type === 'domain' ? (
                            <Globe className="w-3 h-3" />
                          ) : (
                            <Mail className="w-3 h-3" />
                          )}
                          <span>{rule.rule_type}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {rule.reason || 'Unsubscribe request'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(rule.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Remove Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add Suppression Rule */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-md p-6 rounded-2xl space-y-4 border border-slate-700 relative animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldBan className="w-4 h-4 text-rose-400" />
                  <span>Add Suppression Rule</span>
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddRule} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Rule Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRuleType('domain')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        ruleType === 'domain'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      Entire Domain
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleType('email')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        ruleType === 'email'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      Exact Email
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    {ruleType === 'domain' ? 'Domain to Suppress' : 'Email to Suppress'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={ruleValue}
                    onChange={(e) => setRuleValue(e.target.value)}
                    placeholder={ruleType === 'domain' ? 'e.g. competitor.com' : 'e.g. unsubscribe@client.com'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Reason</label>
                  <select
                    value={ruleReason}
                    onChange={(e) => setRuleReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Manual Opt-Out">Manual Opt-Out</option>
                    <option value="Competitor Domain">Competitor Domain</option>
                    <option value="Unsubscribe Request">Unsubscribe Request</option>
                    <option value="Hard Bounce">Hard Bounce</option>
                    <option value="Spam Complaint">Spam Complaint</option>
                  </select>
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
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 cursor-pointer"
                  >
                    Add to Suppression
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
