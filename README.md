# ⚡ LeadFlow AI — AI Lead Discovery & Cold Outreach SaaS Platform

**LeadFlow AI** is a 100% serverless, full-stack B2B SaaS platform for decision-maker lead discovery, deep deliverability validation, and automated multi-step cold email outreach.

---

## 🏗️ Architecture: 100% Serverless & Production-Ready

- **Framework**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons
- **Database**: [Neon](https://neon.tech) Serverless PostgreSQL (`@neondatabase/serverless`)
- **Extraction Engine**: Cheerio live DOM scraping, metadata parsing, and social profile resolution
- **Deliverability Engine**: Native Node.js `dns.promises` MX record resolution, RFC 5322 syntax validation, and burner domain filtering
- **Mail Infrastructure**: Nodemailer authenticated SMTP transport, TLS handshake diagnostics, and variable interpolation
- **Security & Vault**: AES-256-GCM symmetric encryption for mailbox credentials
- **Deployment**: Vercel Edge / Node.js Serverless Functions

---

## 🌟 Key Features

### 🔍 1. Live Lead Discovery & Web Extraction
- **Autonomous Target URL Scraper**: Fetches live web targets, parses HTML with Cheerio, extracts emails from `mailto:` links and text regex, resolves executive titles, and identifies company metadata.
- **Search Discovery**: Target domain and organization prospect extraction.
- **Zero Mock Data**: Discovers live contacts from real internet destinations.

### 🛡️ 2. Deep Email Deliverability & Verification Engine
- **Multi-Stage Diagnostic**: RFC 5322 syntax validation, live DNS MX mail exchange host resolution, 100+ disposable/temporary burner domain filters, and role-based account detection.
- **Deliverability Scoring**: 0–100 confidence score with color-coded safety badges (`Valid`, `Risky`, `Invalid`).
- **Batch Processing**: 1-click list verification before dispatching campaigns.

### ✉️ 3. Cold Outreach & Multi-Step Drip Campaigns
- **Multi-Step Follow-Up Sequences**: Visual sequence builder with custom delay days.
- **Dynamic Variable Interpolation**: Inject `{{first_name}}`, `{{company_name}}`, and `{{email}}` into subjects and templates.
- **Live Dispatch Engine**: Sends real outreach emails via authenticated SMTP mailboxes with automated `List-Unsubscribe` headers.

### 🔐 4. Encrypted SMTP Mailbox Infrastructure
- **AES-256-GCM Vault**: Sensitive SMTP passwords and tokens are encrypted before database persistence.
- **Presets**: One-click configuration for Google Workspace, Microsoft 365, and Custom SMTP relays.
- **Real-Time Handshake Testing**: Interactive connection diagnostic verifies TLS/SSL handshakes directly with the mail server.

### 🚫 5. Compliance & Suppression (CAN-SPAM & GDPR)
- **Automatic Suppression Shield**: Blocks suppressed emails and competitor domains during CSV imports and campaign dispatches.
- **1-Click Unsubscribe**: Automatic compliance footers and opt-out management.

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/Charleskojomark/leadflow-ai.git
cd leadflow-ai/frontend
npm install
```

### 2. Configure Neon PostgreSQL
Create a `.env.local` file inside `frontend/`:
```env
DATABASE_URL="postgres://username:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
SECRET_KEY="your-32-byte-secret-encryption-key"
```

### 3. Initialize Database Schema
Run the local dev server:
```bash
npm run dev
```
Open [http://localhost:3000/settings](http://localhost:3000/settings) and click **"Initialize Schema"** to provision all 8 relational tables and constraints in Neon PostgreSQL.

---

## 🔬 Technical Assessment & System Vetting

### 1. Email Extraction & Web Discovery

| Area | Implementation & Architecture in LeadFlow AI |
|---|---|
| **Accuracy & False Positives** | Powered by `frontend/src/lib/extractor.ts`. Extracts emails from `mailto:` links, metadata, and body text using RFC-compliant pattern matching while stripping standard assets (e.g., `.png`, `.jpg`, font files, placeholder emails). |
| **JavaScript-Rendered Content** | Built on a lightweight, serverless Cheerio HTML parser (`fetch` + Cheerio) optimized for sub-second execution on Vercel Lambdas. It executes against server-rendered static and SSR HTML. Single-page client-only JS applications (e.g., pure CSR React apps with blank raw HTML) require an auxiliary headless browser worker (e.g., Playwright/Puppeteer) to evaluate DOM scripts. |
| **Rate Limiting & Anti-Scraping** | Standard serverless HTTP fetch with configurable headers. For high-volume discovery across aggressive anti-bot platforms (e.g., Cloudflare Under Attack mode), requests can be routed through residential proxy pools or dedicated scraping relays. |
| **LinkedIn & Authenticated Boundaries** | **LeadFlow AI does not attempt credential bypass or authentication breaking on LinkedIn.** Extracting gated LinkedIn profiles requires authorized session tokens (OAuth or cookie-based session injection) or querying public search engine indices (Google/Bing X-Ray search) rather than raw authenticated scraping. |

---

### 2. SMTP Architecture & Deliverability

> [!IMPORTANT]
> Modern deliverability requires **cryptographic alignment (SPF, DKIM, DMARC)** rather than "masking" or spoofing. Concealing originating infrastructure without proper DNS records will cause immediate rejection by major MX providers (Google, Microsoft 365).

| Question / Area | Architectural Assessment |
|---|---|
| **Header Visibility & Masking** | Outbound messages dispatched through `frontend/src/lib/mailer.ts` use your configured relay credentials (e.g., Google Workspace, Amazon SES, Mailgun, custom VPS). Standard MIME headers (`From`, `Reply-To`, `Message-ID`, `X-Mailer: LeadFlow-AI`) are normalized, but RFC 5321 `Received` hops are inserted by the relay MTA and cannot be arbitrarily stripped without triggering spam flags. |
| **SPF / DKIM / DMARC Handling** | Deliverability is maintained by aligning the `From:` domain with the authenticated SMTP server's TXT records. Because LeadFlow AI connects directly to verified user SMTP accounts, messages pass strict DMARC policies (`p=reject` / `p=quarantine`). |
| **Sender Reputation & Throttling** | Regulated by the `smtp_accounts` table with per-account `daily_limit` and `emails_sent_today` tracking to keep volume within safe deliverability thresholds (e.g., max 50–100 emails/day per mailbox during warmup). |
| **Bounce Handling & Pre-Verification** | Handled before sending via `frontend/src/lib/verifier.ts`: verifies email syntax, resolves authoritative DNS MX records in real time, and checks against known disposable/burner domain lists. |

---

### 3. Integration & System Performance

```mermaid
flowchart LR
    A["Discovery / Scraper (extractor.ts)"] --> B["RFC 5322 + DNS MX Check (verifier.ts)"]
    B --> C["Neon PostgreSQL Persistence (db.ts)"]
    C --> D["Suppression Filtering (suppression)"]
    D --> E["AES-256 Authenticated SMTP (mailer.ts)"]
    E --> F["Recipient Mailbox (Google/Outlook)"]
```

1. **End-to-End Workflow:**
   * **Extract:** Scrapes contacts via `/api/v1/extraction/scrape-url` or manual CSV batch upload.
   * **Verify:** Validates domain MX presence and format via `/api/v1/verification/check` or `/api/v1/leads/batch-validate`.
   * **Filter:** Cross-references the global `suppression_rules` table before any queue addition.
   * **Dispatch:** Sends drip steps via `/api/v1/campaigns/[id]/send` through the assigned SMTP account.
2. **Security & Credential Protection:**
   * SMTP credentials are encrypted at rest using **AES-256-GCM** with unique IVs and authentication tags (`frontend/src/lib/db.ts`). Plaintext passwords are never returned over public API endpoints.
   * Database storage is hosted on **Neon Serverless PostgreSQL** with SSL/TLS enforcement (`sslmode=require`).

---

### 4. Benchmarks & Target Metrics

| Metric | Target / Benchmark | LeadFlow AI Mechanism |
|---|---|---|
| **Syntax & MX Verification Accuracy** | > 98% validity | Real Node.js `dns.promises.resolveMx()` domain verification |
| **Bounce Rate** | < 2% (Industry standard: < 3%) | Pre-send verification + real-time suppression list |
| **Database Latency** | < 50ms per query | Neon Connection Pooling via `@neondatabase/serverless` |
| **Delivery Success Rate** | > 95% into Primary Inbox | Dependent on sender domain SPF/DKIM/DMARC health and adherence to daily warm-up limits |

---

## 📄 License
MIT License. Built for modern sales development, growth, and outreach engineering teams.

