'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Trash2,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  FolderPlus,
  Loader2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';
import { Lead, LeadList, LeadCreateInput } from '@/lib/types';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [validationFilter, setValidationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);

  // Form states
  const [newLead, setNewLead] = useState<LeadCreateInput>({
    email: '',
    first_name: '',
    last_name: '',
    company_name: '',
    job_title: '',
    website: '',
    phone: '',
  });

  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);

  useEffect(() => {
    loadLists();
    loadLeads();
  }, [selectedListId, validationFilter, statusFilter]);

  const loadLists = async () => {
    try {
      const data = await api.getLeadLists();
      setLists(data);
    } catch (err) {
      console.error('Failed to load lists:', err);
    }
  };

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await api.getLeads({
        list_id: selectedListId,
        validation_status: validationFilter || undefined,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
        limit: 100,
      });
      setLeads(res.items);
      setSelectedLeadIds([]);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadLeads();
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeadIds(leads.map((l) => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchValidate = async () => {
    if (selectedLeadIds.length === 0) return;
    setActionLoading(true);
    try {
      await api.batchValidateLeads(selectedLeadIds);
      await loadLeads();
    } catch (err) {
      console.error('Batch validation failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleValidate = async (id: number) => {
    try {
      await api.validateLeadEmail(id);
      loadLeads();
    } catch (err) {
      console.error('Validation error:', err);
    }
  };

  const handleDeleteLead = async (id: number) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await api.deleteLead(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setSelectedLeadIds((prev) => prev.filter((item) => item !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createLead({
        ...newLead,
        list_id: selectedListId || (lists[0]?.id ?? undefined),
      });
      setShowAddModal(false);
      setNewLead({
        email: '',
        first_name: '',
        last_name: '',
        company_name: '',
        job_title: '',
        website: '',
        phone: '',
      });
      loadLeads();
      loadLists();
    } catch (err) {
      alert('Failed to add lead');
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName) return;
    try {
      const created = await api.createLeadList({
        name: newListName,
        description: newListDescription,
      });
      setLists((prev) => [...prev, created]);
      setSelectedListId(created.id);
      setShowListModal(false);
      setNewListName('');
      setNewListDescription('');
    } catch (err) {
      alert('Failed to create list');
    }
  };

  const handleUploadCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setActionLoading(true);
    try {
      await api.uploadCsvLeads(csvFile, selectedListId);
      setShowCsvModal(false);
      setCsvFile(null);
      loadLeads();
      loadLists();
    } catch (err) {
      alert('Failed to import CSV');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = () => {
    const leadsToExport =
      selectedLeadIds.length > 0
        ? leads.filter((l) => selectedLeadIds.includes(l.id))
        : leads;

    if (leadsToExport.length === 0) {
      alert('No leads to export');
      return;
    }

    const headers = [
      'Email',
      'First Name',
      'Last Name',
      'Company',
      'Job Title',
      'Website',
      'Validation Status',
      'Deliverability Score',
      'Status',
    ];
    const rows = leadsToExport.map((l) => [
      l.email,
      l.first_name || '',
      l.last_name || '',
      l.company_name || '',
      l.job_title || '',
      l.website || '',
      l.validation_status,
      l.deliverability_score,
      l.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leadflow_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#06090e]">
      <Navbar
        title="Leads & Contact Intelligence"
        subtitle="Manage verified prospect lists, run batch deliverability checks & export data"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Lists Tabs & Top Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <button
              onClick={() => setSelectedListId(undefined)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedListId === undefined
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All Leads ({leads.length})
            </button>
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedListId === list.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {list.name} ({list.lead_count})
              </button>
            ))}
            <button
              onClick={() => setShowListModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-dashed border-slate-700 text-xs font-medium cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New List</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCsvModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-medium transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-medium transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lead</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, company or title..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
          </form>

          <div className="flex items-center gap-3">
            <select
              value={validationFilter}
              onChange={(e) => setValidationFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Validation</option>
              <option value="valid">Valid (Deliverable)</option>
              <option value="risky">Risky (Catch-all)</option>
              <option value="invalid">Invalid</option>
              <option value="unknown">Unknown</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Outreach Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="bounced">Bounced</option>
            </select>

            <button
              onClick={() => {
                setSearchTerm('');
                setValidationFilter('');
                setStatusFilter('');
                loadLeads();
              }}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 text-xs cursor-pointer"
              title="Reset Filters"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bulk Action Ribbon */}
        {selectedLeadIds.length > 0 && (
          <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-between text-xs text-blue-200">
            <span className="font-semibold">
              {selectedLeadIds.length} contact{selectedLeadIds.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleBatchValidate}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>Batch Validate Deliverability</span>
              </button>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Selected</span>
              </button>
            </div>
          </div>
        )}

        {/* Leads Table */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        leads.length > 0 && selectedLeadIds.length === leads.length
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                    />
                  </th>
                  <th className="py-3 px-4 font-semibold">Contact & Title</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                  <th className="py-3 px-4 font-semibold">Deliverability</th>
                  <th className="py-3 px-4 font-semibold">Company / Website</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                      <span>Loading contact records...</span>
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No contacts found matching the filters.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => {
                    const isSelected = selectedLeadIds.includes(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        className={`hover:bg-slate-900/40 transition-colors ${
                          isSelected ? 'bg-blue-950/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(lead.id)}
                            className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                          />
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                              {(lead.first_name || lead.email)[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-200">
                                {lead.full_name ||
                                  `${lead.first_name || ''} ${lead.last_name || ''}`.trim() ||
                                  'Unknown Name'}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {lead.job_title || 'Decision Maker'}
                              </p>
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
                                  : lead.validation_status === 'invalid'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {lead.validation_status === 'valid' ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : lead.validation_status === 'risky' ? (
                                <AlertTriangle className="w-3 h-3" />
                              ) : lead.validation_status === 'invalid' ? (
                                <XCircle className="w-3 h-3" />
                              ) : null}
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
                              href={
                                lead.website.startsWith('http')
                                  ? lead.website
                                  : `https://${lead.website}`
                              }
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
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              lead.status === 'new'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : lead.status === 'contacted'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : lead.status === 'replied'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {lead.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSingleValidate(lead.id)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-700/80 cursor-pointer transition-colors"
                              title="Test Deliverability"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-700/80 cursor-pointer transition-colors"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add Lead */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm">
            <div className="flex min-h-full items-center justify-center p-4">
            <div className="glass-panel w-full max-w-lg p-6 rounded-2xl space-y-4 border border-slate-700 relative my-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span>Create Single Lead Record</span>
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateLead} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">First Name</label>
                    <input
                      type="text"
                      value={newLead.first_name || ''}
                      onChange={(e) => setNewLead({ ...newLead, first_name: e.target.value })}
                      placeholder="Jane"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Last Name</label>
                    <input
                      type="text"
                      value={newLead.last_name || ''}
                      onChange={(e) => setNewLead({ ...newLead, last_name: e.target.value })}
                      placeholder="Doe"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="jane@company.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Company</label>
                    <input
                      type="text"
                      value={newLead.company_name || ''}
                      onChange={(e) => setNewLead({ ...newLead, company_name: e.target.value })}
                      placeholder="Acme Inc"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Job Title</label>
                    <input
                      type="text"
                      value={newLead.job_title || ''}
                      onChange={(e) => setNewLead({ ...newLead, job_title: e.target.value })}
                      placeholder="VP of Growth"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Company Website</label>
                  <input
                    type="text"
                    value={newLead.website || ''}
                    onChange={(e) => setNewLead({ ...newLead, website: e.target.value })}
                    placeholder="https://acme.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 cursor-pointer"
                  >
                    Save Contact
                  </button>
                </div>
              </form>
            </div>
            </div>
          </div>
        )}

        {/* Modal: CSV Upload */}
        {showCsvModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm">
            <div className="flex min-h-full items-center justify-center p-4">
            <div className="glass-panel w-full max-w-lg p-6 rounded-2xl space-y-4 border border-slate-700 relative my-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Import Leads Spreadsheet (CSV)</span>
                </h3>
                <button
                  onClick={() => setShowCsvModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUploadCsv} className="space-y-4">
                <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center space-y-2 hover:border-blue-500/50 transition-colors">
                  <Upload className="w-8 h-8 text-blue-400 mx-auto" />
                  <p className="text-xs font-medium text-slate-300">
                    {csvFile ? csvFile.name : 'Drag & drop your CSV file here, or click to browse'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Supports headers: email, first_name, last_name, company, title, website
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    required
                    onChange={(e) => e.target.files && setCsvFile(e.target.files[0])}
                    className="w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer pt-2"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCsvModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!csvFile || actionLoading}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Upload & Process</span>
                  </button>
                </div>
              </form>
            </div>
            </div>
          </div>
        )}

        {/* Modal: New List */}
        {showListModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm">
            <div className="flex min-h-full items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md p-6 rounded-2xl space-y-4 border border-slate-700 relative my-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-blue-400" />
                  <span>Create Lead Segment List</span>
                </h3>
                <button
                  onClick={() => setShowListModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateList} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">List Name *</label>
                  <input
                    type="text"
                    required
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g. Fintech Founders Series A"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Description</label>
                  <textarea
                    rows={3}
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    placeholder="Targeting YC companies and seed tech startups"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowListModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 cursor-pointer"
                  >
                    Create List
                  </button>
                </div>
              </form>
            </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
