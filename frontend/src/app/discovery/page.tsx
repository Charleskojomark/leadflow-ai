'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Plus,
  Layers,
  Database,
  ShieldCheck,
  Cpu,
  Clock,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';
import { LeadList, ExtractionJob, Lead } from '@/lib/types';

export default function DiscoveryPage() {
  const [activeTab, setActiveTab] = useState<'url' | 'search'>('url');
  const [targetUrl, setTargetUrl] = useState('https://linear.app');
  const [searchQuery, setSearchQuery] = useState('"VP Sales" OR "Founder" SaaS "San Francisco" site:linkedin.com/in');
  const [numResults, setNumResults] = useState(10);
  const [selectedListId, setSelectedListId] = useState<number | undefined>(undefined);
  const [autoValidate, setAutoValidate] = useState(true);

  const [lists, setLists] = useState<LeadList[]>([]);
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [extractedLeads, setExtractedLeads] = useState<Lead[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    loadListsAndJobs();
  }, []);

  const loadListsAndJobs = async () => {
    try {
      const [listsData, jobsData] = await Promise.all([
        api.getLeadLists().catch(() => []),
        api.getExtractionJobs().catch(() => []),
      ]);
      setLists(listsData);
      if (listsData.length > 0 && !selectedListId) {
        setSelectedListId(listsData[0].id);
      }
      setJobs(jobsData);
    } catch (err) {
      console.error('Error loading lists or jobs:', err);
    }
  };

  const handleRunUrlExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl) return;

    setIsExtracting(true);
    setStatusMessage('Connecting to web target, extracting metadata, emails & technologies...');
    try {
      const res = await api.extractFromUrl({
        url: targetUrl,
        list_id: selectedListId,
        auto_validate: autoValidate,
      });

      setStatusMessage(`Extraction completed successfully! Found ${res.leads_found} contacts.`);
      if (res.results && res.results.length > 0) {
        setExtractedLeads(res.results);
      } else {
        // Fetch leads from the list
        const leadsRes = await api.getLeads({ list_id: selectedListId, limit: 10 });
        setExtractedLeads(leadsRes.items);
      }
      loadListsAndJobs();
    } catch (err: any) {
      setStatusMessage(`Extraction error: ${err.message || 'Failed to extract'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRunSearchExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    setIsExtracting(true);
    setStatusMessage(`Running discovery simulator for query: "${searchQuery}"...`);
    try {
      const res = await api.extractFromSearch({
        query: searchQuery,
        num_results: numResults,
        list_id: selectedListId,
        auto_validate: autoValidate,
      });

      setStatusMessage(`Discovery completed! Found ${res.leads_found} high-intent prospects.`);
      if (res.results && res.results.length > 0) {
        setExtractedLeads(res.results);
      } else {
        const leadsRes = await api.getLeads({ list_id: selectedListId, limit: 10 });
        setExtractedLeads(leadsRes.items);
      }
      loadListsAndJobs();
    } catch (err: any) {
      setStatusMessage(`Discovery error: ${err.message || 'Search extraction failed'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#06090e]">
      <Navbar
        title="AI Lead Discovery"
        subtitle="Extract targeted decision-maker contacts directly from URLs & search queries"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl w-full mx-auto">
        {/* Modes Toggle Header */}
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900/80 border border-slate-800 w-fit">
          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'url'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Target Website Scraper</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Google Search Query Simulator</span>
          </button>
        </div>

        {/* Discovery Input Card */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
          {activeTab === 'url' ? (
            <form onSubmit={handleRunUrlExtraction} className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <span>Target URL Company & Contact Extraction</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Scrapes the website HTML, extracts contact emails, social links (LinkedIn, Twitter),
                  detects tech stack footprint, and identifies company metadata.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target Website URL</label>
                  <div className="relative">
                    <input
                      type="url"
                      required
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Destination List</label>
                  <select
                    value={selectedListId || ''}
                    onChange={(e) => setSelectedListId(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.lead_count} leads)
                      </option>
                    ))}
                    {lists.length === 0 && <option value="">Default List</option>}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoValidate}
                    onChange={(e) => setAutoValidate(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Auto-verify emails with MX DNS check during extraction</span>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isExtracting}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting Contacts...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Start Extraction</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRunSearchExtraction} className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>Google Search Query Lead Simulator</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Run targeted Boolean search strings across social profiles, company directories,
                  and professional networks to discover qualified leads.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Boolean Search Query</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='site:linkedin.com/in "Founder" "SaaS"'
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Max Results to Discover</label>
                  <select
                    value={numResults}
                    onChange={(e) => setNumResults(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value={5}>5 High-Intent Prospects</option>
                    <option value={10}>10 High-Intent Prospects</option>
                    <option value={25}>25 High-Intent Prospects</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Destination List</label>
                  <select
                    value={selectedListId || ''}
                    onChange={(e) => setSelectedListId(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.lead_count} leads)
                      </option>
                    ))}
                    {lists.length === 0 && <option value="">Default List</option>}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoValidate}
                    onChange={(e) => setAutoValidate(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Run deep deliverability checks on extracted contacts</span>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isExtracting}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Simulating Search Discovery...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Discover Prospects</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {statusMessage && (
            <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span>Extracted Contacts & Intel ({extractedLeads.length})</span>
            </h3>
            {extractedLeads.length > 0 && (
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved to Selected Lead List</span>
              </span>
            )}
          </div>

          {extractedLeads.length === 0 ? (
            <div className="glass-panel p-10 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Search className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-300">Ready to Discover Leads</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Enter a target domain or search query above and click Start Extraction to view
                discovered emails, company titles, and deliverability ratings.
              </p>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Contact & Title</th>
                      <th className="py-3 px-4 font-semibold">Email Address</th>
                      <th className="py-3 px-4 font-semibold">Deliverability</th>
                      <th className="py-3 px-4 font-semibold">Company / Website</th>
                      <th className="py-3 px-4 font-semibold">Detected Stack</th>
                      <th className="py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {extractedLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                              {(lead.first_name || lead.email)[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-200">
                                {lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Executive'}
                              </p>
                              <p className="text-[11px] text-slate-400">{lead.job_title || 'Decision Maker'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-300">{lead.email}</td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                lead.validation_status === 'valid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : lead.validation_status === 'risky'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {lead.validation_status === 'valid' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : lead.validation_status === 'risky' ? (
                                <AlertTriangle className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              <span className="capitalize">{lead.validation_status}</span>
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">
                              {lead.deliverability_score}/100
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-medium text-slate-200">{lead.company_name || 'N/A'}</p>
                          {lead.website && (
                            <a
                              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <span>{lead.website.replace('https://', '')}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {lead.tags && lead.tags.length > 0 ? (
                              lead.tags.map((t, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                                >
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-500">React, Stripe, AWS</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-[11px] text-emerald-400 font-medium px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                            Saved
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
