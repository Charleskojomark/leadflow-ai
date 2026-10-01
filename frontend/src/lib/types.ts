export type EmailValidationStatus = 'valid' | 'risky' | 'invalid' | 'unknown';
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'bounced' | 'unsubscribed';
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
export type SmtpProvider = 'gmail' | 'outlook' | 'custom';

export interface User {
  id: number;
  email: string;
  full_name?: string;
  is_active: boolean;
  role: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LeadList {
  id: number;
  name: string;
  description?: string;
  lead_count: number;
  created_at: string;
  updated_at?: string;
}

export interface Lead {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company_name?: string;
  job_title?: string;
  website?: string;
  phone?: string;
  linkedin_url?: string;
  twitter_url?: string;
  city?: string;
  country?: string;
  source?: string;
  validation_status: EmailValidationStatus;
  deliverability_score: number;
  status: LeadStatus;
  notes?: string;
  tags?: string[];
  list_id?: number;
  list_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface LeadCreateInput {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  job_title?: string;
  website?: string;
  phone?: string;
  linkedin_url?: string;
  twitter_url?: string;
  city?: string;
  country?: string;
  source?: string;
  notes?: string;
  tags?: string[];
  list_id?: number;
  validation_status?: EmailValidationStatus;
  deliverability_score?: number;
  status?: LeadStatus;
}

export interface ValidationDetail {
  email: string;
  status: EmailValidationStatus;
  score: number;
  syntax_valid: boolean;
  mx_records_found: boolean;
  is_disposable: boolean;
  is_free_provider: boolean;
  smtp_pingable: boolean;
  details: string;
}

export interface ExtractionJob {
  id: number;
  job_type: 'url_scrape' | 'search_discovery' | 'bulk_urls';
  target_query: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  leads_found: number;
  created_at: string;
  completed_at?: string;
  results?: Lead[];
}

export interface SmtpAccount {
  id: number;
  name: string;
  provider: SmtpProvider;
  host: string;
  port: number;
  username: string;
  from_name: string;
  from_email: string;
  use_tls: boolean;
  use_ssl: boolean;
  daily_limit: number;
  emails_sent_today: number;
  is_active: boolean;
  created_at: string;
  connection_status?: 'verified' | 'failed' | 'untested';
  last_tested_at?: string;
  last_error?: string;
}

export interface SmtpAccountInput {
  name: string;
  provider: SmtpProvider;
  host: string;
  port: number;
  username: string;
  password?: string;
  from_name: string;
  from_email: string;
  use_tls: boolean;
  use_ssl: boolean;
  daily_limit: number;
  connection_status?: 'verified' | 'failed' | 'untested';
  last_tested_at?: string;
  last_error?: string;
}

export interface CampaignStep {
  id?: number;
  step_number: number;
  delay_days: number;
  subject: string;
  body_template: string;
}

export interface Campaign {
  id: number;
  name: string;
  description?: string;
  status: CampaignStatus;
  smtp_account_id?: number;
  smtp_account_name?: string;
  lead_list_id?: number;
  lead_list_name?: string;
  total_leads: number;
  sent_count: number;
  open_count: number;
  reply_count: number;
  bounce_count: number;
  daily_limit: number;
  track_opens?: boolean;
  track_clicks?: boolean;
  created_at: string;
  updated_at?: string;
  steps?: CampaignStep[];
}

export interface CampaignCreateInput {
  name: string;
  description?: string;
  smtp_account_id?: number;
  lead_list_id?: number;
  daily_limit: number;
  track_opens: boolean;
  track_clicks: boolean;
  steps: {
    step_number: number;
    delay_days: number;
    subject: string;
    body_template: string;
  }[];
}

export interface SuppressionRule {
  id: number;
  rule_type: 'email' | 'domain';
  value: string;
  reason?: string;
  created_at: string;
}

export interface DashboardMetrics {
  total_leads: number;
  valid_leads: number;
  risky_leads: number;
  invalid_leads: number;
  total_campaigns: number;
  active_campaigns: number;
  total_emails_sent: number;
  overall_open_rate: number;
  overall_reply_rate: number;
  overall_bounce_rate: number;
  active_smtp_count: number;
}

export interface ActivityLogItem {
  id: number;
  action: string;
  entity_type: string;
  entity_id?: number;
  details?: string;
  created_at: string;
}
