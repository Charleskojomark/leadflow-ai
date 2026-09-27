'use client';

import React, { useState, useEffect } from 'react';
import {
  MailCheck,
  Plus,
  Play,
  Pause,
  Trash2,
  Send,
  Eye,
  MessageSquare,
  AlertOctagon,
  Clock,
  Sparkles,
  Users,
  Server,
  X,
  Loader2,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';
import { Campaign, SmtpAccount, LeadList, CampaignCreateInput } from '@/lib/types';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSmtpId, setFormSmtpId] = useState<number | undefined>(undefined);
  const [formListId, setFormListId] = useState<number | undefined>(undefined);
  const [formDailyLimit, setFormDailyLimit] = useState(50);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);

  // Multi-step sequence
  const [steps, setSteps] = useState<
    { step_number: number; delay_days: number; subject: string; body_template: string }[]
  >([
    {
      step_number: 1,
      delay_days: 0,
      subject: 'Quick question regarding growth at {{company}}',
      body_template:
        'Hi {{firstName}},\n\nI noticed the impressive work you are doing at {{company}}. We recently built an AI-driven outreach engine that discovered and verified prospects with 99% deliverability.\n\nWould you be open to a 5-minute chat this Thursday?\n\nBest,\nAlex',
    },
    {
      step_number: 2,
      delay_days: 3,
      subject: 'Re: Quick question regarding growth at {{company}}',
      body_template:
        'Hi {{firstName}},\n\nFollowing up on my previous note. Wanted to share a 1-page breakdown of how similar teams improved deliverability.\n\nLet me know if you would like me to send it over.\n\nBest,\nAlex',
    },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campaignsData, smtpData, listsData] = await Promise.all([
        api.getCampaigns().catch(() => []),
        api.getSmtpAccounts().catch(() => []),
        api.getLeadLists().catch(() => []),
      ]);
      setCampaigns(campaignsData);
      setSmtpAccounts(smtpData);
      setLists(listsData);

      if (smtpData.length > 0) setFormSmtpId(smtpData[0].id);
      if (listsData.length > 0) setFormListId(listsData[0].id);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStep = () => {
    const nextNumber = steps.length + 1;
    setSteps([
      ...steps,
      {
        step_number: nextNumber,
        delay_days: 5,
        subject: `Re: Follow up #${nextNumber - 1}`,
        body_template: 'Hi {{firstName}},\n\nJust checking in one last time...\n\nBest,\nAlex',
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleInsertVariable = (stepIndex: number, variableName: string) => {
    const updated = [...steps];
    updated[stepIndex].body_template += ` {{${variableName}}}`;
    setSteps(updated);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    try {
      await api.createCampaign({
        name: formName,
        description: formDescription,
        smtp_account_id: formSmtpId,
        lead_list_id: formListId,
        daily_limit: formDailyLimit,
        track_opens: trackOpens,
        track_clicks: trackClicks,
        steps,
      });
      setShowModal(false);
      setFormName('');
      setFormDescription('');
      loadData();
    } catch (err: any) {
      alert(`Error creating campaign: ${err.message || 'Failed'}`);
    }
  };

  const handleLaunchCampaign = async (campaignId: number, dryRun: boolean) => {
    setActionLoadingId(campaignId);
    try {
      const res = await api.launchCampaign(campaignId, dryRun);
      alert(res.message || (dryRun ? 'Dry run completed successfully!' : 'Campaign launched!'));
      loadData();
    } catch (err: any) {
      alert(`Launch error: ${err.message || 'Failed'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: number) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await api.deleteCampaign(campaignId);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#06090e]">
      <Navbar
        title="Cold Outreach & Drip Campaigns"
        subtitle="Orchestrate multi-step cold email sequences with personalized variables and rate limits"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Active Campaigns</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {campaigns.length} Total
            </span>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Campaign</span>
          </button>
        </div>

        {/* Campaigns Grid */}
        {loading ? (
          <div className="glass-panel p-12 rounded-2xl text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            <span>Loading campaigns...</span>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <MailCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-300">No Outreach Campaigns Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first multi-step automated cold email drip sequence to start engaging prospects.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-600/30 cursor-pointer"
            >
              Build Sequence
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map((camp) => {
              const openRate =
                camp.sent_count > 0 ? Math.round((camp.open_count / camp.sent_count) * 100) : 0;
              const replyRate =
                camp.sent_count > 0 ? Math.round((camp.reply_count / camp.sent_count) * 100) : 0;

              return (
                <div
                  key={camp.id}
                  className="glass-panel p-6 rounded-2xl glow-card space-y-5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white tracking-tight">
                            {camp.name}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                              camp.status === 'running'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : camp.status === 'scheduled'
                                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {camp.status}
                          </span>
                        </div>
                        {camp.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                            {camp.description}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteCampaign(camp.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Delete Campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800">
                        <Server className="w-3 h-3 text-blue-400" />
                        <span>{camp.smtp_account_name || 'Primary SMTP'}</span>
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800">
                        <Users className="w-3 h-3 text-emerald-400" />
                        <span>{camp.lead_list_name || 'Prospects'}</span>
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800">
                        <Layers className="w-3 h-3 text-purple-400" />
                        <span>{camp.steps?.length || 2} Sequence Steps</span>
                      </span>
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center">
                      <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                        <p className="text-[10px] text-slate-500 font-medium">Sent</p>
                        <p className="text-sm font-bold text-white mt-0.5">{camp.sent_count}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                        <p className="text-[10px] text-slate-500 font-medium">Opened</p>
                        <p className="text-sm font-bold text-emerald-400 mt-0.5">{openRate}%</p>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                        <p className="text-[10px] text-slate-500 font-medium">Replied</p>
                        <p className="text-sm font-bold text-blue-400 mt-0.5">{replyRate}%</p>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                        <p className="text-[10px] text-slate-500 font-medium">Bounced</p>
                        <p className="text-sm font-bold text-rose-400 mt-0.5">{camp.bounce_count}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => handleLaunchCampaign(camp.id, true)}
                      disabled={actionLoadingId === camp.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      <span>Test / Dry Run</span>
                    </button>

                    <button
                      onClick={() => handleLaunchCampaign(camp.id, false)}
                      disabled={actionLoadingId === camp.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 cursor-pointer transition-colors"
                    >
                      {actionLoadingId === camp.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Launch Live</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Sequence & Campaign Builder */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl space-y-5 border border-slate-700 relative my-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MailCheck className="w-4 h-4 text-blue-400" />
                  <span>Outreach Campaign & Drip Flow Builder</span>
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateCampaign} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Campaign Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Q4 SaaS Founders Outreach"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Daily Max Send Quota
                    </label>
                    <input
                      type="number"
                      value={formDailyLimit}
                      onChange={(e) => setFormDailyLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Sending Inbox (SMTP)
                    </label>
                    <select
                      value={formSmtpId || ''}
                      onChange={(e) => setFormSmtpId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {smtpAccounts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.from_email})
                        </option>
                      ))}
                      {smtpAccounts.length === 0 && <option value="">Primary Mailer</option>}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Target Lead Segment
                    </label>
                    <select
                      value={formListId || ''}
                      onChange={(e) => setFormListId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.lead_count} contacts)
                        </option>
                      ))}
                      {lists.length === 0 && <option value="">Default List</option>}
                    </select>
                  </div>
                </div>

                {/* Sequence Steps */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Drip Email Sequence ({steps.length} Steps)
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddStep}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Follow-up Step</span>
                    </button>
                  </div>

                  {steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-blue-400">
                          Step #{idx + 1} {idx === 0 ? '(Initial Pitch)' : `(Wait ${step.delay_days} days)`}
                        </span>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
                            className="text-xs text-rose-400 hover:text-rose-300"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <input
                          type="text"
                          required
                          value={step.subject}
                          onChange={(e) => {
                            const copy = [...steps];
                            copy[idx].subject = e.target.value;
                            setSteps(copy);
                          }}
                          placeholder="Subject Line..."
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-medium focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">Insert tag:</span>
                          {['firstName', 'company', 'jobTitle'].map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => handleInsertVariable(idx, v)}
                              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 font-mono"
                            >
                              +{`{{${v}}}`}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={4}
                          required
                          value={step.body_template}
                          onChange={(e) => {
                            const copy = [...steps];
                            copy[idx].body_template = e.target.value;
                            setSteps(copy);
                          }}
                          className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                        />
                      </div>
                    </div>
                  ))}
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
                    Create & Save Campaign
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
