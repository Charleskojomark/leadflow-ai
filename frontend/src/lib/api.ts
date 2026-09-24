import {
  AuthResponse,
  DashboardMetrics,
  ActivityLogItem,
  LeadList,
  Lead,
  LeadCreateInput,
  ValidationDetail,
  ExtractionJob,
  SmtpAccount,
  SmtpAccountInput,
  Campaign,
  CampaignCreateInput,
  SuppressionRule,
  User,
} from './types';

// Use relative API base so serverless route handlers work on any deployment URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('leadflow_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('leadflow_token', token);
      } else {
        localStorage.removeItem('leadflow_token');
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('leadflow_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
    }

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // use default error message
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  }

  // Auth methods
  async login(formData: FormData): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: formData,
    });
  }

  async register(data: { email: string; password: string; full_name?: string }): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setToken(res.access_token);
    return res;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Dashboard
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      return await this.request<DashboardMetrics>('/dashboard/metrics');
    } catch {
      return {
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
      };
    }
  }

  async getActivityLogs(limit = 20): Promise<ActivityLogItem[]> {
    try {
      return await this.request<ActivityLogItem[]>(`/dashboard/activity-logs?limit=${limit}`);
    } catch {
      return [];
    }
  }

  // Leads & Lists
  async getLeadLists(): Promise<LeadList[]> {
    try {
      return await this.request<LeadList[]>('/leads/lists');
    } catch {
      return [];
    }
  }

  async createLeadList(data: { name: string; description?: string }): Promise<LeadList> {
    return this.request<LeadList>('/leads/lists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getLeads(params: {
    list_id?: number;
    validation_status?: string;
    status?: string;
    search?: string;
    skip?: number;
    limit?: number;
  } = {}): Promise<{ items: Lead[]; total: number }> {
    const query = new URLSearchParams();
    if (params.list_id) query.append('list_id', params.list_id.toString());
    if (params.validation_status) query.append('validation_status', params.validation_status);
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.skip !== undefined) query.append('skip', params.skip.toString());
    if (params.limit !== undefined) query.append('limit', params.limit.toString());

    try {
      return await this.request<{ items: Lead[]; total: number }>(`/leads?${query.toString()}`);
    } catch {
      return { items: [], total: 0 };
    }
  }

  async createLead(data: LeadCreateInput): Promise<Lead> {
    return this.request<Lead>('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: number, data: Partial<LeadCreateInput>): Promise<Lead> {
    return this.request<Lead>(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLead(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/leads/${id}`, {
      method: 'DELETE',
    });
  }

  async validateLeadEmail(id: number): Promise<ValidationDetail> {
    return this.request<ValidationDetail>(`/leads/${id}/validate`, {
      method: 'POST',
    });
  }

  async batchValidateLeads(leadIds: number[]): Promise<{ validated: number; results: ValidationDetail[] }> {
    return this.request<{ validated: number; results: ValidationDetail[] }>('/leads/batch-validate', {
      method: 'POST',
      body: JSON.stringify({ lead_ids: leadIds }),
    });
  }

  async uploadCsvLeads(file: File, listId?: number): Promise<{ imported: number; failed: number }> {
    const formData = new FormData();
    formData.append('file', file);
    if (listId) formData.append('list_id', listId.toString());

    const res = await fetch(`${API_BASE}/leads/upload-csv`, {
      method: 'POST',
      headers: this.getToken() ? { Authorization: `Bearer ${this.getToken()}` } : {},
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'CSV upload failed');
    }

    return await res.json();
  }

  // Extraction Engine
  async extractFromUrl(data: { url: string; list_id?: number; auto_validate?: boolean }): Promise<ExtractionJob> {
    return this.request<ExtractionJob>('/extraction/scrape-url', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async extractFromSearch(data: { query: string; num_results?: number; list_id?: number; auto_validate?: boolean }): Promise<ExtractionJob> {
    return this.request<ExtractionJob>('/extraction/search-discovery', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getExtractionJobs(): Promise<ExtractionJob[]> {
    try {
      return await this.request<ExtractionJob[]>('/extraction/jobs');
    } catch {
      return [];
    }
  }

  // SMTP Accounts
  async getSmtpAccounts(): Promise<SmtpAccount[]> {
    try {
      return await this.request<SmtpAccount[]>('/smtp');
    } catch {
      return [];
    }
  }

  async createSmtpAccount(data: SmtpAccountInput): Promise<SmtpAccount> {
    return this.request<SmtpAccount>('/smtp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSmtpAccount(id: number, data: Partial<SmtpAccountInput>): Promise<SmtpAccount> {
    return this.request<SmtpAccount>(`/smtp/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async testSmtpAccount(id: number): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/smtp/${id}/test`, {
      method: 'POST',
    });
  }

  async deleteSmtpAccount(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/smtp/${id}`, {
      method: 'DELETE',
    });
  }

  // Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    try {
      return await this.request<Campaign[]>('/campaigns');
    } catch {
      return [];
    }
  }

  async getCampaign(id: number): Promise<Campaign> {
    return this.request<Campaign>(`/campaigns/${id}`);
  }

  async createCampaign(data: CampaignCreateInput): Promise<Campaign> {
    return this.request<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCampaign(id: number, data: Partial<CampaignCreateInput>): Promise<Campaign> {
    return this.request<Campaign>(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCampaign(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/campaigns/${id}`, {
      method: 'DELETE',
    });
  }

  async launchCampaign(id: number, dryRun = false): Promise<{ message: string; sent: number; errors: number }> {
    return this.request<{ message: string; sent: number; errors: number }>(`/campaigns/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ dry_run: dryRun }),
    });
  }

  // Suppression
  async getSuppressionList(): Promise<SuppressionRule[]> {
    try {
      return await this.request<SuppressionRule[]>('/suppression');
    } catch {
      return [];
    }
  }

  async addSuppressionRule(data: { rule_type: 'email' | 'domain'; value: string; reason?: string }): Promise<SuppressionRule> {
    return this.request<SuppressionRule>('/suppression', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteSuppressionRule(id: number): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/suppression/${id}`, {
      method: 'DELETE',
    });
  }

  // Database status & migration
  async getDatabaseStatus(): Promise<any> {
    return this.request<any>('/database');
  }

  async initDatabase(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/database', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
