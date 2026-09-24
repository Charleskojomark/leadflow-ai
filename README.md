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

## 📄 License
MIT License. Built for modern sales development, growth, and outreach engineering teams.
