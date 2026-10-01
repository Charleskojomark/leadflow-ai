import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import {
  LeadList,
  Lead,
  LeadCreateInput,
  ValidationDetail,
  ExtractionJob,
  SmtpAccount,
  SmtpAccountInput,
  Campaign,
  CampaignCreateInput,
  CampaignStep,
  SuppressionRule,
  DashboardMetrics,
  ActivityLogItem,
} from './types';

// Encrypt/Decrypt helpers using native Node crypto (AES-256-GCM)
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.SECRET_KEY || 'leadflow-ai-serverless-secret-key-32b',
  'salt',
  32
);

export function encryptCredential(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decryptCredential(cipherText: string): string {
  try {
    const [ivHex, tagHex, encryptedHex] = cipherText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '******';
  }
}

export function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
}

export function isDbConfigured(): boolean {
  const url = getDatabaseUrl();
  return Boolean(url && (url.startsWith('postgres://') || url.startsWith('postgresql://')));
}

export function getSql() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set. Please provide a Neon PostgreSQL connection string.');
  }
  return neon(dbUrl);
}

// In-Memory Storage used ONLY as temporary fallback when DATABASE_URL is not yet provided
class MemoryStore {
  lists: LeadList[] = [];
  leads: Lead[] = [];
  campaigns: Campaign[] = [];
  smtpAccounts: SmtpAccount[] = [];
  smtpPasswords: Map<number, string> = new Map();
  suppressionRules: SuppressionRule[] = [];
  jobs: ExtractionJob[] = [];
  activityLogs: ActivityLogItem[] = [];
}

const memoryStore = new MemoryStore();

/**
 * Initializes Neon PostgreSQL database tables if they do not exist
 */
export async function initDb(): Promise<{ success: boolean; message: string }> {
  if (!isDbConfigured()) {
    return {
      success: false,
      message: 'DATABASE_URL is not configured. Running in memory-only mode without persistence.',
    };
  }

  const sql = getSql();

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS lead_lists (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        lead_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        full_name VARCHAR(200),
        company_name VARCHAR(200),
        job_title VARCHAR(200),
        website VARCHAR(500),
        phone VARCHAR(100),
        linkedin_url VARCHAR(500),
        twitter_url VARCHAR(500),
        city VARCHAR(100),
        country VARCHAR(100),
        source VARCHAR(100) DEFAULT 'manual',
        validation_status VARCHAR(50) DEFAULT 'unknown',
        deliverability_score INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'new',
        notes TEXT,
        tags TEXT[] DEFAULT '{}',
        list_id INTEGER REFERENCES lead_lists(id) ON DELETE SET NULL,
        mx_records JSONB DEFAULT '[]',
        validation_details JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_email_per_list UNIQUE(email, list_id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS smtp_accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        provider VARCHAR(50) DEFAULT 'custom',
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL DEFAULT 587,
        username VARCHAR(255) NOT NULL,
        encrypted_password TEXT,
        from_name VARCHAR(255) NOT NULL,
        from_email VARCHAR(255) NOT NULL,
        use_tls BOOLEAN DEFAULT TRUE,
        use_ssl BOOLEAN DEFAULT FALSE,
        daily_limit INTEGER DEFAULT 500,
        emails_sent_today INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        connection_status VARCHAR(50) DEFAULT 'untested',
        last_error TEXT,
        last_tested_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    try {
      await sql`ALTER TABLE smtp_accounts ADD COLUMN IF NOT EXISTS connection_status VARCHAR(50) DEFAULT 'untested';`;
      await sql`ALTER TABLE smtp_accounts ADD COLUMN IF NOT EXISTS last_error TEXT;`;
      await sql`ALTER TABLE smtp_accounts ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMP WITH TIME ZONE;`;
    } catch {
      // Columns may already exist
    }

    await sql`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'draft',
        smtp_account_id INTEGER REFERENCES smtp_accounts(id) ON DELETE SET NULL,
        lead_list_id INTEGER REFERENCES lead_lists(id) ON DELETE SET NULL,
        total_leads INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        open_count INTEGER DEFAULT 0,
        reply_count INTEGER DEFAULT 0,
        bounce_count INTEGER DEFAULT 0,
        daily_limit INTEGER DEFAULT 100,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS campaign_steps (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL DEFAULT 1,
        delay_days INTEGER NOT NULL DEFAULT 0,
        subject VARCHAR(500) NOT NULL,
        body_template TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS campaign_logs (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
        lead_email VARCHAR(255),
        step_number INTEGER DEFAULT 1,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        message_id VARCHAR(255),
        sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS suppression_rules (
        id SERIAL PRIMARY KEY,
        rule_type VARCHAR(50) NOT NULL,
        value VARCHAR(255) NOT NULL,
        reason VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS extraction_jobs (
        id SERIAL PRIMARY KEY,
        job_type VARCHAR(50) NOT NULL,
        target_query TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        leads_found INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    return {
      success: true,
      message: 'Neon PostgreSQL schema initialized successfully with all relational tables and constraints.',
    };
  } catch (error: any) {
    console.error('Failed to initialize Neon DB:', error);
    return {
      success: false,
      message: `Database initialization error: ${error.message}`,
    };
  }
}

// ==========================================
// REAL REPOSITORY FUNCTIONS
// ==========================================

export async function logActivity(action: string, entity_type: string, details: string) {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      await sql`
        INSERT INTO activity_logs (action, entity_type, details)
        VALUES (${action}, ${entity_type}, ${details})
      `;
      return;
    } catch (err) {
      console.error('Failed to log activity to Neon:', err);
    }
  }

  memoryStore.activityLogs.unshift({
    id: Date.now(),
    action,
    entity_type,
    details,
    created_at: new Date().toISOString(),
  });
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      const [leadsStats] = await sql`
        SELECT 
          COUNT(*)::int AS total_leads,
          COUNT(*) FILTER (WHERE validation_status = 'valid')::int AS valid_leads,
          COUNT(*) FILTER (WHERE validation_status = 'risky')::int AS risky_leads,
          COUNT(*) FILTER (WHERE validation_status = 'invalid')::int AS invalid_leads
        FROM leads;
      `;

      const [campaignStats] = await sql`
        SELECT 
          COUNT(*)::int AS total_campaigns,
          COUNT(*) FILTER (WHERE status = 'running')::int AS active_campaigns,
          COALESCE(SUM(sent_count), 0)::int AS total_emails_sent,
          COALESCE(SUM(open_count), 0)::int AS total_opened,
          COALESCE(SUM(reply_count), 0)::int AS total_replied,
          COALESCE(SUM(bounce_count), 0)::int AS total_bounced
        FROM campaigns;
      `;

      const [smtpStats] = await sql`
        SELECT COUNT(*)::int AS active_smtp_count
        FROM smtp_accounts
        WHERE is_active = true;
      `;

      const totalSent = campaignStats?.total_emails_sent || 0;
      const totalOpened = campaignStats?.total_opened || 0;
      const totalReplied = campaignStats?.total_replied || 0;
      const totalBounced = campaignStats?.total_bounced || 0;

      return {
        total_leads: leadsStats?.total_leads || 0,
        valid_leads: leadsStats?.valid_leads || 0,
        risky_leads: leadsStats?.risky_leads || 0,
        invalid_leads: leadsStats?.invalid_leads || 0,
        total_campaigns: campaignStats?.total_campaigns || 0,
        active_campaigns: campaignStats?.active_campaigns || 0,
        total_emails_sent: totalSent,
        overall_open_rate: totalSent > 0 ? Number(((totalOpened / totalSent) * 100).toFixed(1)) : 0,
        overall_reply_rate: totalSent > 0 ? Number(((totalReplied / totalSent) * 100).toFixed(1)) : 0,
        overall_bounce_rate: totalSent > 0 ? Number(((totalBounced / totalSent) * 100).toFixed(1)) : 0,
        active_smtp_count: smtpStats?.active_smtp_count || 0,
      };
    } catch (err) {
      console.error('Failed to get dashboard metrics from Neon:', err);
    }
  }

  // Real empty state (no fake data)
  const total = memoryStore.leads.length;
  const valid = memoryStore.leads.filter((l) => l.validation_status === 'valid').length;
  const risky = memoryStore.leads.filter((l) => l.validation_status === 'risky').length;
  const invalid = memoryStore.leads.filter((l) => l.validation_status === 'invalid').length;
  const totalCamps = memoryStore.campaigns.length;
  const activeCamps = memoryStore.campaigns.filter((c) => c.status === 'running').length;
  const totalSent = memoryStore.campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);

  return {
    total_leads: total,
    valid_leads: valid,
    risky_leads: risky,
    invalid_leads: invalid,
    total_campaigns: totalCamps,
    active_campaigns: activeCamps,
    total_emails_sent: totalSent,
    overall_open_rate: 0,
    overall_reply_rate: 0,
    overall_bounce_rate: 0,
    active_smtp_count: memoryStore.smtpAccounts.filter((s) => s.is_active).length,
  };
}

export async function getActivityLogs(limit = 10): Promise<ActivityLogItem[]> {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT id, action, entity_type, details, created_at
        FROM activity_logs
        ORDER BY created_at DESC
        LIMIT ${limit};
      `;
      return rows.map((r: any) => ({
        id: r.id,
        action: r.action,
        entity_type: r.entity_type,
        details: r.details,
        created_at: new Date(r.created_at).toISOString(),
      }));
    } catch (err) {
      console.error('Failed to fetch activity logs from Neon:', err);
    }
  }

  return memoryStore.activityLogs.slice(0, limit);
}

// ------------------------------------------
// LEAD LISTS
// ------------------------------------------

export async function getLeadLists(): Promise<LeadList[]> {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT 
          l.id,
          l.name,
          l.description,
          COUNT(leads.id)::int AS lead_count,
          l.created_at,
          l.updated_at
        FROM lead_lists l
        LEFT JOIN leads ON leads.list_id = l.id
        GROUP BY l.id
        ORDER BY l.created_at DESC;
      `;
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        lead_count: r.lead_count || 0,
        created_at: new Date(r.created_at).toISOString(),
        updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
      }));
    } catch (err) {
      console.error('Failed to fetch lead lists from Neon:', err);
    }
  }

  return memoryStore.lists;
}

export async function createLeadList(data: { name: string; description?: string }): Promise<LeadList> {
  if (isDbConfigured()) {
    const sql = getSql();
    const [row] = await sql`
      INSERT INTO lead_lists (name, description)
      VALUES (${data.name}, ${data.description || null})
      RETURNING id, name, description, lead_count, created_at;
    `;
    await logActivity('LIST_CREATED', 'lead_list', `Created contact list "${data.name}"`);
    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      lead_count: 0,
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  const newList: LeadList = {
    id: Date.now(),
    name: data.name,
    description: data.description || '',
    lead_count: 0,
    created_at: new Date().toISOString(),
  };
  memoryStore.lists.push(newList);
  await logActivity('LIST_CREATED', 'lead_list', `Created contact list "${data.name}"`);
  return newList;
}

// ------------------------------------------
// LEADS
// ------------------------------------------

export interface LeadFilters {
  list_id?: number;
  validation_status?: string;
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export async function getLeads(filters: LeadFilters = {}): Promise<{ items: Lead[]; total: number }> {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      const skip = filters.skip || 0;
      const limit = filters.limit || 100;

      // Base query builder
      const rows = await sql`
        SELECT 
          l.*,
          lists.name AS list_name
        FROM leads l
        LEFT JOIN lead_lists lists ON lists.id = l.list_id
        WHERE 
          (${filters.list_id ? filters.list_id : null}::int IS NULL OR l.list_id = ${filters.list_id || null})
          AND (${filters.validation_status ? filters.validation_status : null}::text IS NULL OR l.validation_status = ${filters.validation_status || null})
          AND (${filters.status ? filters.status : null}::text IS NULL OR l.status = ${filters.status || null})
          AND (${filters.search ? `%${filters.search.toLowerCase()}%` : null}::text IS NULL OR (
            LOWER(l.email) LIKE ${filters.search ? `%${filters.search.toLowerCase()}%` : null}
            OR LOWER(COALESCE(l.full_name, '')) LIKE ${filters.search ? `%${filters.search.toLowerCase()}%` : null}
            OR LOWER(COALESCE(l.company_name, '')) LIKE ${filters.search ? `%${filters.search.toLowerCase()}%` : null}
          ))
        ORDER BY l.created_at DESC
        OFFSET ${skip}
        LIMIT ${limit};
      `;

      const [countRow] = await sql`
        SELECT COUNT(*)::int AS count
        FROM leads l
        WHERE 
          (${filters.list_id ? filters.list_id : null}::int IS NULL OR l.list_id = ${filters.list_id || null})
          AND (${filters.validation_status ? filters.validation_status : null}::text IS NULL OR l.validation_status = ${filters.validation_status || null})
          AND (${filters.status ? filters.status : null}::text IS NULL OR l.status = ${filters.status || null})
          AND (${filters.search ? `%${filters.search.toLowerCase()}%` : null}::text IS NULL OR (
            LOWER(l.email) LIKE ${filters.search ? `%${filters.search.toLowerCase()}%` : null}
            OR LOWER(COALESCE(l.full_name, '')) LIKE ${filters.search ? `%${filters.search.toLowerCase()}%` : null}
            OR LOWER(COALESCE(l.company_name, '')) LIKE ${filters.search ? `%${filters.search.toLowerCase()}%` : null}
          ));
      `;

      const items: Lead[] = rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        first_name: r.first_name || '',
        last_name: r.last_name || '',
        full_name: r.full_name || '',
        company_name: r.company_name || '',
        job_title: r.job_title || '',
        website: r.website || '',
        phone: r.phone || '',
        linkedin_url: r.linkedin_url || '',
        twitter_url: r.twitter_url || '',
        city: r.city || '',
        country: r.country || '',
        source: r.source || 'manual',
        validation_status: r.validation_status || 'unknown',
        deliverability_score: r.deliverability_score || 0,
        status: r.status || 'new',
        notes: r.notes || '',
        tags: r.tags || [],
        list_id: r.list_id,
        list_name: r.list_name || '',
        created_at: new Date(r.created_at).toISOString(),
      }));

      return { items, total: countRow?.count || 0 };
    } catch (err) {
      console.error('Failed to query leads from Neon:', err);
    }
  }

  let filtered = [...memoryStore.leads];
  if (filters.list_id) filtered = filtered.filter((l) => l.list_id === filters.list_id);
  if (filters.validation_status) filtered = filtered.filter((l) => l.validation_status === filters.validation_status);
  if (filters.status) filtered = filtered.filter((l) => l.status === filters.status);
  if (filters.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.email.toLowerCase().includes(s) ||
        (l.company_name && l.company_name.toLowerCase().includes(s)) ||
        (l.full_name && l.full_name.toLowerCase().includes(s))
    );
  }

  const skip = filters.skip || 0;
  const limit = filters.limit || 100;
  return {
    items: filtered.slice(skip, skip + limit),
    total: filtered.length,
  };
}

export async function createLead(data: LeadCreateInput): Promise<Lead> {
  const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email.split('@')[0];

  if (isDbConfigured()) {
    const sql = getSql();
    const [row] = await sql`
      INSERT INTO leads (
        email, first_name, last_name, full_name, company_name, job_title,
        website, phone, linkedin_url, twitter_url, city, country, source,
        validation_status, deliverability_score, status, notes, tags, list_id
      ) VALUES (
        ${data.email.toLowerCase().trim()},
        ${data.first_name || null},
        ${data.last_name || null},
        ${fullName},
        ${data.company_name || null},
        ${data.job_title || null},
        ${data.website || null},
        ${data.phone || null},
        ${data.linkedin_url || null},
        ${data.twitter_url || null},
        ${data.city || null},
        ${data.country || null},
        ${data.source || 'manual'},
        ${data.validation_status || 'unknown'},
        ${data.deliverability_score || 0},
        ${data.status || 'new'},
        ${data.notes || null},
        ${data.tags || []},
        ${data.list_id || null}
      )
      ON CONFLICT (email, list_id) DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, leads.first_name),
        last_name = COALESCE(EXCLUDED.last_name, leads.last_name),
        company_name = COALESCE(EXCLUDED.company_name, leads.company_name),
        validation_status = CASE WHEN EXCLUDED.validation_status != 'unknown' THEN EXCLUDED.validation_status ELSE leads.validation_status END,
        deliverability_score = GREATEST(EXCLUDED.deliverability_score, leads.deliverability_score),
        updated_at = NOW()
      RETURNING *;
    `;

    await logActivity('LEAD_CREATED', 'lead', `Added lead ${data.email} (${data.company_name || 'Individual'})`);

    return {
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      full_name: row.full_name,
      company_name: row.company_name,
      job_title: row.job_title,
      website: row.website,
      phone: row.phone,
      linkedin_url: row.linkedin_url,
      twitter_url: row.twitter_url,
      city: row.city,
      country: row.country,
      source: row.source,
      validation_status: row.validation_status,
      deliverability_score: row.deliverability_score,
      status: row.status,
      notes: row.notes,
      tags: row.tags,
      list_id: row.list_id,
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  const newLead: Lead = {
    id: Date.now(),
    ...data,
    email: data.email.toLowerCase().trim(),
    full_name: fullName,
    validation_status: data.validation_status || 'unknown',
    deliverability_score: data.deliverability_score || 0,
    status: data.status || 'new',
    created_at: new Date().toISOString(),
  };
  memoryStore.leads.unshift(newLead);
  await logActivity('LEAD_CREATED', 'lead', `Added lead ${data.email}`);
  return newLead;
}

export async function getLeadById(id: number): Promise<Lead | null> {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      const [row] = await sql`
        SELECT 
          l.*,
          lists.name AS list_name
        FROM leads l
        LEFT JOIN lead_lists lists ON lists.id = l.list_id
        WHERE l.id = ${id}
        LIMIT 1;
      `;
      if (!row) return null;
      return {
        id: row.id,
        email: row.email,
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        full_name: row.full_name || '',
        company_name: row.company_name || '',
        job_title: row.job_title || '',
        website: row.website || '',
        phone: row.phone || '',
        linkedin_url: row.linkedin_url || '',
        twitter_url: row.twitter_url || '',
        city: row.city || '',
        country: row.country || '',
        source: row.source || 'manual',
        validation_status: row.validation_status || 'unknown',
        deliverability_score: row.deliverability_score || 0,
        status: row.status || 'new',
        notes: row.notes || '',
        tags: row.tags || [],
        list_id: row.list_id,
        list_name: row.list_name || '',
        created_at: new Date(row.created_at).toISOString(),
      };
    } catch (err) {
      console.error('Failed to get lead by id:', err);
    }
  }

  return memoryStore.leads.find((l) => l.id === id) || null;
}

export async function updateLead(id: number, updates: Partial<Lead>): Promise<Lead | null> {
  if (isDbConfigured()) {
    const sql = getSql();
    const [row] = await sql`
      UPDATE leads
      SET 
        validation_status = COALESCE(${updates.validation_status || null}, validation_status),
        deliverability_score = COALESCE(${updates.deliverability_score !== undefined ? updates.deliverability_score : null}, deliverability_score),
        status = COALESCE(${updates.status || null}, status),
        notes = COALESCE(${updates.notes || null}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      full_name: row.full_name,
      company_name: row.company_name,
      job_title: row.job_title,
      website: row.website,
      phone: row.phone,
      linkedin_url: row.linkedin_url,
      twitter_url: row.twitter_url,
      city: row.city,
      country: row.country,
      source: row.source,
      validation_status: row.validation_status,
      deliverability_score: row.deliverability_score,
      status: row.status,
      notes: row.notes,
      tags: row.tags,
      list_id: row.list_id,
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  const lead = memoryStore.leads.find((l) => l.id === id);
  if (!lead) return null;
  Object.assign(lead, updates, { updated_at: new Date().toISOString() });
  return lead;
}

export async function deleteLead(id: number): Promise<boolean> {
  if (isDbConfigured()) {
    const sql = getSql();
    const rows = await sql`DELETE FROM leads WHERE id = ${id} RETURNING id;`;
    return rows.length > 0;
  }
  const idx = memoryStore.leads.findIndex((l) => l.id === id);
  if (idx === -1) return false;
  memoryStore.leads.splice(idx, 1);
  return true;
}

// ------------------------------------------
// SMTP ACCOUNTS
// ------------------------------------------

export async function getSmtpAccounts(): Promise<SmtpAccount[]> {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT id, name, provider, host, port, username, from_name, from_email, use_tls, use_ssl, daily_limit, emails_sent_today, is_active,
               COALESCE(connection_status, 'untested') as connection_status,
               last_error,
               last_tested_at,
               created_at
        FROM smtp_accounts
        ORDER BY created_at DESC;
      `;
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        provider: r.provider,
        host: r.host,
        port: r.port,
        username: r.username,
        from_name: r.from_name,
        from_email: r.from_email,
        use_tls: r.use_tls,
        use_ssl: r.use_ssl,
        daily_limit: r.daily_limit,
        emails_sent_today: r.emails_sent_today,
        is_active: r.is_active,
        connection_status: r.connection_status || 'untested',
        last_error: r.last_error || undefined,
        last_tested_at: r.last_tested_at ? new Date(r.last_tested_at).toISOString() : undefined,
        created_at: new Date(r.created_at).toISOString(),
      }));
    } catch (err) {
      console.error('Failed to query SMTP accounts from Neon:', err);
    }
  }

  return memoryStore.smtpAccounts;
}

export async function createSmtpAccount(data: SmtpAccountInput & { encrypted_password?: string }): Promise<SmtpAccount> {
  const encPass = data.encrypted_password || (data.password ? encryptCredential(data.password) : '');
  const connStatus = data.connection_status || 'untested';

  if (isDbConfigured()) {
    const sql = getSql();
    const [row] = await sql`
      INSERT INTO smtp_accounts (
        name, provider, host, port, username, encrypted_password, from_name, from_email, use_tls, use_ssl, daily_limit, is_active, connection_status, last_error, last_tested_at
      ) VALUES (
        ${data.name},
        ${data.provider || 'custom'},
        ${data.host},
        ${data.port || 587},
        ${data.username},
        ${encPass},
        ${data.from_name},
        ${data.from_email},
        ${data.use_tls !== undefined ? data.use_tls : true},
        ${data.use_ssl !== undefined ? data.use_ssl : false},
        ${data.daily_limit || 500},
        true,
        ${connStatus},
        ${data.last_error || null},
        ${data.last_tested_at ? new Date(data.last_tested_at) : (connStatus === 'verified' ? new Date() : null)}
      )
      RETURNING id, name, provider, host, port, username, from_name, from_email, use_tls, use_ssl, daily_limit, emails_sent_today, is_active, connection_status, last_error, last_tested_at, created_at;
    `;

    await logActivity('SMTP_CONFIGURED', 'smtp', `Configured mailbox "${data.name}" (${data.from_email}) - Status: ${connStatus}`);

    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      host: row.host,
      port: row.port,
      username: row.username,
      from_name: row.from_name,
      from_email: row.from_email,
      use_tls: row.use_tls,
      use_ssl: row.use_ssl,
      daily_limit: row.daily_limit,
      emails_sent_today: row.emails_sent_today,
      is_active: row.is_active,
      connection_status: row.connection_status || 'untested',
      last_error: row.last_error || undefined,
      last_tested_at: row.last_tested_at ? new Date(row.last_tested_at).toISOString() : undefined,
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  const newAcc: SmtpAccount = {
    id: Date.now(),
    name: data.name,
    provider: data.provider || 'custom',
    host: data.host,
    port: data.port || 587,
    username: data.username,
    from_name: data.from_name,
    from_email: data.from_email,
    use_tls: data.use_tls !== undefined ? data.use_tls : true,
    use_ssl: data.use_ssl !== undefined ? data.use_ssl : false,
    daily_limit: data.daily_limit || 500,
    emails_sent_today: 0,
    is_active: true,
    connection_status: connStatus,
    last_error: data.last_error,
    last_tested_at: data.last_tested_at,
    created_at: new Date().toISOString(),
  };
  memoryStore.smtpAccounts.push(newAcc);
  if (data.password) {
    memoryStore.smtpPasswords.set(newAcc.id, data.password);
  }
  await logActivity('SMTP_CONFIGURED', 'smtp', `Configured mailbox "${data.name}" (${data.from_email}) - Status: ${connStatus}`);
  return newAcc;
}

export async function updateSmtpAccountStatus(
  id: number,
  status: 'verified' | 'failed',
  errorMsg?: string
): Promise<void> {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      await sql`
        UPDATE smtp_accounts
        SET connection_status = ${status},
            last_error = ${errorMsg || null},
            last_tested_at = NOW()
        WHERE id = ${id};
      `;
    } catch (err) {
      console.error('Failed to update SMTP account status in DB:', err);
    }
  }

  const acc = memoryStore.smtpAccounts.find((s) => s.id === id);
  if (acc) {
    acc.connection_status = status;
    acc.last_error = errorMsg;
    acc.last_tested_at = new Date().toISOString();
  }
}

export async function getSmtpAccountRaw(id: number): Promise<{ account: SmtpAccount; decrypted_pass: string } | null> {
  if (isDbConfigured()) {
    const sql = getSql();
    const [row] = await sql`SELECT * FROM smtp_accounts WHERE id = ${id};`;
    if (!row) return null;
    const account: SmtpAccount = {
      id: row.id,
      name: row.name,
      provider: row.provider,
      host: row.host,
      port: row.port,
      username: row.username,
      from_name: row.from_name,
      from_email: row.from_email,
      use_tls: row.use_tls,
      use_ssl: row.use_ssl,
      daily_limit: row.daily_limit,
      emails_sent_today: row.emails_sent_today,
      is_active: row.is_active,
      connection_status: row.connection_status || 'untested',
      last_error: row.last_error || undefined,
      last_tested_at: row.last_tested_at ? new Date(row.last_tested_at).toISOString() : undefined,
      created_at: new Date(row.created_at).toISOString(),
    };
    const decrypted_pass = row.encrypted_password ? decryptCredential(row.encrypted_password) : '';
    return { account, decrypted_pass };
  }

  const acc = memoryStore.smtpAccounts.find((s) => s.id === id);
  if (!acc) return null;
  const pass = memoryStore.smtpPasswords.get(id) || '';
  return { account: acc, decrypted_pass: pass };
}

export async function deleteSmtpAccount(id: number): Promise<boolean> {
  if (isDbConfigured()) {
    const sql = getSql();
    const rows = await sql`DELETE FROM smtp_accounts WHERE id = ${id} RETURNING id;`;
    return rows.length > 0;
  }
  const idx = memoryStore.smtpAccounts.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  memoryStore.smtpAccounts.splice(idx, 1);
  return true;
}

// ------------------------------------------
// CAMPAIGNS
// ------------------------------------------

export async function getCampaigns(): Promise<Campaign[]> {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT 
          c.*,
          smtp.name AS smtp_account_name,
          lists.name AS lead_list_name
        FROM campaigns c
        LEFT JOIN smtp_accounts smtp ON smtp.id = c.smtp_account_id
        LEFT JOIN lead_lists lists ON lists.id = c.lead_list_id
        ORDER BY c.created_at DESC;
      `;
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        status: r.status,
        smtp_account_id: r.smtp_account_id,
        smtp_account_name: r.smtp_account_name || '',
        lead_list_id: r.lead_list_id,
        lead_list_name: r.lead_list_name || '',
        total_leads: r.total_leads || 0,
        sent_count: r.sent_count || 0,
        open_count: r.open_count || 0,
        reply_count: r.reply_count || 0,
        bounce_count: r.bounce_count || 0,
        daily_limit: r.daily_limit || 100,
        created_at: new Date(r.created_at).toISOString(),
      }));
    } catch (err) {
      console.error('Failed to query campaigns from Neon:', err);
    }
  }

  return memoryStore.campaigns;
}

export async function createCampaign(data: CampaignCreateInput): Promise<Campaign> {
  if (isDbConfigured()) {
    const sql = getSql();
    const [row] = await sql`
      INSERT INTO campaigns (
        name, description, status, smtp_account_id, lead_list_id, daily_limit
      ) VALUES (
        ${data.name},
        ${data.description || null},
        'draft',
        ${data.smtp_account_id || null},
        ${data.lead_list_id || null},
        ${data.daily_limit || 100}
      )
      RETURNING *;
    `;

    // Insert campaign steps
    if (data.steps && data.steps.length > 0) {
      for (const step of data.steps) {
        await sql`
          INSERT INTO campaign_steps (campaign_id, step_number, delay_days, subject, body_template)
          VALUES (${row.id}, ${step.step_number}, ${step.delay_days}, ${step.subject}, ${step.body_template});
        `;
      }
    }

    await logActivity('CAMPAIGN_CREATED', 'campaign', `Created campaign "${data.name}"`);

    return {
      id: row.id,
      name: row.name,
      description: row.description || '',
      status: row.status,
      smtp_account_id: row.smtp_account_id,
      lead_list_id: row.lead_list_id,
      total_leads: 0,
      sent_count: 0,
      open_count: 0,
      reply_count: 0,
      bounce_count: 0,
      daily_limit: row.daily_limit,
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  const newCamp: Campaign = {
    id: Date.now(),
    name: data.name,
    description: data.description || '',
    status: 'draft',
    smtp_account_id: data.smtp_account_id,
    lead_list_id: data.lead_list_id,
    total_leads: 0,
    sent_count: 0,
    open_count: 0,
    reply_count: 0,
    bounce_count: 0,
    daily_limit: data.daily_limit || 100,
    created_at: new Date().toISOString(),
    steps: data.steps,
  };
  memoryStore.campaigns.unshift(newCamp);
  await logActivity('CAMPAIGN_CREATED', 'campaign', `Created campaign "${data.name}"`);
  return newCamp;
}

export async function updateCampaign(id: number, updates: Partial<Campaign>): Promise<Campaign | null> {
  if (isDbConfigured()) {
    const sql = getSql();
    const [row] = await sql`
      UPDATE campaigns
      SET
        status = COALESCE(${updates.status || null}, status),
        sent_count = COALESCE(${updates.sent_count !== undefined ? updates.sent_count : null}, sent_count),
        open_count = COALESCE(${updates.open_count !== undefined ? updates.open_count : null}, open_count),
        reply_count = COALESCE(${updates.reply_count !== undefined ? updates.reply_count : null}, reply_count),
        bounce_count = COALESCE(${updates.bounce_count !== undefined ? updates.bounce_count : null}, bounce_count),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *;
    `;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      smtp_account_id: row.smtp_account_id,
      lead_list_id: row.lead_list_id,
      total_leads: row.total_leads,
      sent_count: row.sent_count,
      open_count: row.open_count,
      reply_count: row.reply_count,
      bounce_count: row.bounce_count,
      daily_limit: row.daily_limit,
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  const camp = memoryStore.campaigns.find((c) => c.id === id);
  if (!camp) return null;
  Object.assign(camp, updates);
  return camp;
}

// ------------------------------------------
// SUPPRESSION RULES
// ------------------------------------------

export async function getSuppressionRules(): Promise<SuppressionRule[]> {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM suppression_rules ORDER BY created_at DESC;`;
      return rows.map((r: any) => ({
        id: r.id,
        rule_type: r.rule_type,
        value: r.value,
        reason: r.reason || '',
        created_at: new Date(r.created_at).toISOString(),
      }));
    } catch (err) {
      console.error('Failed to query suppression rules from Neon:', err);
    }
  }

  return memoryStore.suppressionRules;
}

export async function createSuppressionRule(data: { rule_type: 'domain' | 'email'; value: string; reason?: string }): Promise<SuppressionRule> {
  if (isDbConfigured()) {
    const sql = getSql();
    const [row] = await sql`
      INSERT INTO suppression_rules (rule_type, value, reason)
      VALUES (${data.rule_type}, ${data.value.toLowerCase().trim()}, ${data.reason || null})
      RETURNING *;
    `;
    await logActivity('SUPPRESSION_ADDED', 'suppression', `Suppressed ${data.rule_type}: ${data.value}`);
    return {
      id: row.id,
      rule_type: row.rule_type,
      value: row.value,
      reason: row.reason || '',
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  const rule: SuppressionRule = {
    id: Date.now(),
    rule_type: data.rule_type,
    value: data.value.toLowerCase().trim(),
    reason: data.reason || '',
    created_at: new Date().toISOString(),
  };
  memoryStore.suppressionRules.push(rule);
  await logActivity('SUPPRESSION_ADDED', 'suppression', `Suppressed ${data.rule_type}: ${data.value}`);
  return rule;
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const cleanEmail = email.toLowerCase().trim();
  const domain = cleanEmail.split('@')[1];

  if (isDbConfigured()) {
    try {
      const sql = getSql();
      const [row] = await sql`
        SELECT id FROM suppression_rules
        WHERE (rule_type = 'email' AND LOWER(value) = ${cleanEmail})
           OR (rule_type = 'domain' AND LOWER(value) = ${domain})
        LIMIT 1;
      `;
      return Boolean(row);
    } catch (err) {
      console.error('Failed to check suppression from Neon:', err);
    }
  }

  return memoryStore.suppressionRules.some(
    (r) =>
      (r.rule_type === 'email' && r.value.toLowerCase() === cleanEmail) ||
      (r.rule_type === 'domain' && r.value.toLowerCase() === domain)
  );
}

// ------------------------------------------
// EXTRACTION JOBS
// ------------------------------------------

export async function createExtractionJob(job_type: 'url_scrape' | 'search_discovery' | 'bulk_urls', target_query: string): Promise<ExtractionJob> {
  if (isDbConfigured()) {
    const sql = getSql();
    const [row] = await sql`
      INSERT INTO extraction_jobs (job_type, target_query, status, leads_found)
      VALUES (${job_type}, ${target_query}, 'pending', 0)
      RETURNING *;
    `;
    return {
      id: row.id,
      job_type: row.job_type,
      target_query: row.target_query,
      status: row.status,
      leads_found: row.leads_found,
      created_at: new Date(row.created_at).toISOString(),
    };
  }

  const job: ExtractionJob = {
    id: Date.now(),
    job_type,
    target_query,
    status: 'pending',
    leads_found: 0,
    created_at: new Date().toISOString(),
  };
  memoryStore.jobs.unshift(job);
  return job;
}

export async function updateExtractionJob(id: number, status: 'completed' | 'failed', leads_found: number): Promise<void> {
  if (isDbConfigured()) {
    const sql = getSql();
    await sql`
      UPDATE extraction_jobs
      SET status = ${status}, leads_found = ${leads_found}, completed_at = NOW()
      WHERE id = ${id};
    `;
    return;
  }

  const job = memoryStore.jobs.find((j) => j.id === id);
  if (job) {
    job.status = status;
    job.leads_found = leads_found;
    job.completed_at = new Date().toISOString();
  }
}
