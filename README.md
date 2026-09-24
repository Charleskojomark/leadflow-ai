# ⚡ LeadFlow AI — AI-Powered Lead Discovery & Cold Outreach SaaS Platform

**LeadFlow AI** is a production-oriented, full-stack B2B SaaS platform designed to streamline decision-maker lead generation, deep deliverability validation, and multi-step automated cold outreach.

---

## 🌟 Key Features

### 🔍 1. AI-Powered Lead Discovery & Web Extraction
- **Target URL Scraper**: Autonomous company scraper that extracts verified emails, executive names, phone numbers, and social links (LinkedIn, Twitter).
- **Google Search Query Simulator**: High-intent Boolean search discovery across professional networks and company directories.
- **Tech Stack Profiling**: Detects underlying web technologies (e.g. Next.js, React, Tailwind, Stripe, AWS, Postgres).

### 🛡️ 2. Deep Email Deliverability & Verification Engine
- **Multi-Stage Diagnostic**: RFC 5322 syntax validation, DNS MX host resolution, disposable/temporary burner email filtering, and simulated SMTP handshakes.
- **Deliverability Scoring**: 0–100 confidence score with color-coded safety badges (`Valid`, `Risky`, `Invalid`).
- **Batch Processing**: 1-click list verification before launching campaigns to protect domain reputation.

### ✉️ 3. Cold Outreach & Multi-Step Drip Campaigns
- **Visual Sequence Builder**: Multi-step automated follow-up sequences with customizable delay days.
- **Dynamic Variable Interpolation**: Inject `{{firstName}}`, `{{company}}`, and `{{jobTitle}}` seamlessly.
- **Safety Throttling**: Daily send quotas, open tracking pixels, click tracking, and dry-run preview mode.

### 🔐 4. Encrypted SMTP Mailbox Infrastructure
- **Fernet AES-256 Vault**: Sensitive SMTP app passwords and tokens are encrypted before database persistence.
- **Preset Integrations**: One-click configuration for Google Workspace, Microsoft 365, and Custom SMTP.
- **Real-Time Handshake Testing**: Interactive connection diagnostic verifies TLS/SSL handshakes directly with the mail server.

### 🚫 5. Compliance & Suppression (CAN-SPAM & GDPR)
- **Automatic Hard-Bounce Shield**: Catches SMTP 550 errors and auto-appends to the suppression list.
- **Domain Masking**: Suppress entire competitor or client domains.
- **1-Click Unsubscribe**: Automatic `List-Unsubscribe` headers and opt-out links.

---

## 🏗️ Technical Architecture

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons
- **Backend API**: FastAPI (Python 3.12+), Pydantic v2, Asynchronous IO
- **Database**: SQLAlchemy 2.0 Async, Aiosqlite (WAL mode)
- **Security & Encryption**: Fernet AES-256 symmetric encryption, PyJWT
- **Email & Extraction**: `aiosmtplib`, `BeautifulSoup4`, `dnspython`

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js 18+ (tested on Node 26)
- Python 3.10+
- Git

### 1. Start the FastAPI Backend
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
python run.py
```
*API will be live at `http://127.0.0.1:8000` with interactive Swagger docs at `/docs`.*

### 2. Start the Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend will be live at `http://localhost:3000`.*

---

## 🧪 Running Automated Tests
```bash
cd backend
pytest
```
*Runs all 14 comprehensive unit and workflow integration tests.*

---

## 📄 License
MIT License. Built for modern sales development, growth, and outreach engineering teams.
