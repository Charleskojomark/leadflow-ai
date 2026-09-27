const BASE = 'https://frontend-three-self-45.vercel.app';

async function runEvaluations() {
  console.log(`\n======================================================`);
  console.log(`🔬 EXECUTING PHASE 1 & PHASE 2 LIVE EVALUATIONS`);
  console.log(`Target Host: ${BASE}`);
  console.log(`======================================================\n`);

  // ----------------------------------------------------
  // PHASE 1: LIVE SCRAPING & DISCOVERY
  // ----------------------------------------------------
  console.log(`\n--- [PHASE 1] Live Web Scraping Benchmark ---\n`);

  const scrapeTargets = [
    'https://httpbin.org',
    'https://news.ycombinator.com'
  ];

  for (const targetUrl of scrapeTargets) {
    console.log(`\nTarget: ${targetUrl}`);
    const startTime = Date.now();
    try {
      const res = await fetch(`${BASE}/api/v1/extraction/scrape-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });

      const elapsed = Date.now() - startTime;
      const data = await res.json();

      if (res.status === 200) {
        console.log(`Status: HTTP ${res.status} (${elapsed}ms)`);
        console.log(`Title: "${data.metadata?.title || 'N/A'}"`);
        console.log(`Company Inferred: "${data.metadata?.company || 'N/A'}"`);
        console.log(`Social Links:`, data.metadata?.socials || {});
        console.log(`Leads Extracted: ${data.leads_found}`);
        if (data.results && data.results.length > 0) {
          console.log(`Sample Leads Extracted:`);
          data.results.slice(0, 3).forEach((lead, i) => {
            console.log(`  [${i + 1}] Email: ${lead.email} | Name: ${lead.first_name} ${lead.last_name} | Score: ${lead.deliverability_score}`);
          });
        }
      } else {
        console.log(`HTTP ${res.status}: ${data.detail || JSON.stringify(data)}`);
      }
    } catch (err) {
      console.error(`Scrape execution error: ${err.message}`);
    }
  }

  // ----------------------------------------------------
  // PHASE 2: MULTI-VECTOR EMAIL VERIFICATION
  // ----------------------------------------------------
  console.log(`\n\n--- [PHASE 2] Multi-Vector Email Verification Benchmark ---\n`);

  const testEmails = [
    { email: 'contact@google.com', category: 'Valid Corporate (Google)' },
    { email: 'hello@cloudflare.com', category: 'Valid Corporate (Cloudflare)' },
    { email: 'user@deaddomainthatdoesnotexist999888.com', category: 'Dead Domain (No MX)' },
    { email: 'test@mailinator.com', category: 'Disposable Burner Email' },
    { email: 'temporary@10minutemail.com', category: 'Disposable Burner Email' },
    { email: 'not-a-valid-email-string', category: 'RFC 5322 Syntax Error' },
    { email: 'support@github.com', category: 'Role-Based Address (Support)' },
    { email: 'sales@amazon.com', category: 'Role-Based Address (Sales)' }
  ];

  console.log(`Testing ${testEmails.length} email vectors across DNS MX, RFC regex, and disposable detection:\n`);

  for (const item of testEmails) {
    const startTime = Date.now();
    try {
      const res = await fetch(`${BASE}/api/v1/verification/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: item.email })
      });
      const elapsed = Date.now() - startTime;
      const data = await res.json();

      console.log(`------------------------------------------------------`);
      console.log(`Target: ${item.email}`);
      console.log(`Category: ${item.category}`);
      console.log(`Latency: ${elapsed}ms | HTTP ${res.status}`);
      console.log(`Verdict: Status = [${data.status?.toUpperCase() || 'UNKNOWN'}] | Score = [${data.score}/100]`);
      console.log(`Checks: Valid Format = ${data.format_valid} | Has MX = ${data.mx_valid} | Disposable = ${data.is_disposable} | Role = ${data.is_role_based}`);
      if (data.mx_records && data.mx_records.length > 0) {
        console.log(`Resolved MX: ${data.mx_records.map(m => `${m.exchange} (prio ${m.priority})`).join(', ')}`);
      }
    } catch (err) {
      console.error(`Verification error for ${item.email}: ${err.message}`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🏁 PHASE 1 & PHASE 2 EVALUATION FINISHED`);
  console.log(`======================================================\n`);
}

runEvaluations().catch(console.error);
