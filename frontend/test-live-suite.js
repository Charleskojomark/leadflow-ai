const BASE = process.env.TEST_URL || 'https://frontend-three-self-45.vercel.app';

async function runLiveTests() {
  console.log(`\n======================================================`);
  console.log(`🚀 LEADFLOW AI — PRODUCTION SMOKE TEST SUITE`);
  console.log(`Target: ${BASE}`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      process.stdout.write(`Testing: ${name}... `);
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log('❌ FAIL:', err.message);
      failed++;
    }
  }

  // 1. Health Endpoint
  await check('GET /api/health', async () => {
    const res = await fetch(`${BASE}/api/health`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.status !== 'healthy' || !json.database.configured) {
      throw new Error(`Unexpected health payload: ${JSON.stringify(json)}`);
    }
  });

  // 2. Metrics Endpoint
  await check('GET /api/v1/dashboard/metrics', async () => {
    const res = await fetch(`${BASE}/api/v1/dashboard/metrics`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (typeof json.total_leads !== 'number') throw new Error('Missing total_leads in metrics');
  });

  // 3. Activity Logs
  await check('GET /api/v1/dashboard/activity-logs', async () => {
    const res = await fetch(`${BASE}/api/v1/dashboard/activity-logs`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Expected array of logs');
  });

  // 4. Lead Lists (GET)
  await check('GET /api/v1/leads/lists', async () => {
    const res = await fetch(`${BASE}/api/v1/leads/lists`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Expected array of lists');
  });

  // 5. Create Lead List (POST)
  let createdListId = null;
  await check('POST /api/v1/leads/lists', async () => {
    const res = await fetch(`${BASE}/api/v1/leads/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Smoke Test List ${Date.now()}`,
        description: 'Automated verification test list'
      })
    });
    if (res.status !== 201) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (!json.id) throw new Error('No list id returned');
    createdListId = json.id;
  });

  // 6. Create Lead (POST)
  let createdLeadId = null;
  await check('POST /api/v1/leads', async () => {
    const res = await fetch(`${BASE}/api/v1/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `tester-${Date.now()}@example.com`,
        first_name: 'Alex',
        last_name: 'Rivera',
        company_name: 'Acme Global',
        job_title: 'Growth Director',
        list_id: createdListId
      })
    });
    if (res.status !== 201) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (!json.id) throw new Error('No lead id returned');
    createdLeadId = json.id;
  });

  // 7. Get All Leads
  await check('GET /api/v1/leads', async () => {
    const res = await fetch(`${BASE}/api/v1/leads`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json.items) || typeof json.total !== 'number') {
      throw new Error('Invalid leads pagination structure');
    }
  });

  // 8. Lead Verification (Real RFC + DNS MX)
  await check('POST /api/v1/verification/check', async () => {
    const res = await fetch(`${BASE}/api/v1/verification/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@gmail.com' })
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (!json.status || typeof json.score !== 'number') throw new Error('Invalid verification result');
  });

  // 9. Lead Validation (POST /api/v1/leads/:id/validate)
  await check('POST /api/v1/leads/:id/validate', async () => {
    const res = await fetch(`${BASE}/api/v1/leads/${createdLeadId}/validate`, {
      method: 'POST'
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (!json.status) throw new Error('Missing validation status');
  });

  // 10. SMTP Accounts (GET)
  await check('GET /api/v1/smtp', async () => {
    const res = await fetch(`${BASE}/api/v1/smtp`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Expected array');
  });

  // 11. Campaigns (GET)
  await check('GET /api/v1/campaigns', async () => {
    const res = await fetch(`${BASE}/api/v1/campaigns`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Expected array');
  });

  // 12. Suppression Rules (GET)
  await check('GET /api/v1/suppression', async () => {
    const res = await fetch(`${BASE}/api/v1/suppression`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Expected array');
  });

  // 13. Clean up lead (DELETE /api/v1/leads/:id)
  await check('DELETE /api/v1/leads/:id', async () => {
    const res = await fetch(`${BASE}/api/v1/leads/${createdLeadId}`, {
      method: 'DELETE'
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 14. UI Pages
  const pages = ['/', '/discovery', '/leads', '/campaigns', '/smtp', '/suppression', '/verification', '/settings'];
  for (const page of pages) {
    await check(`GET UI Page ${page}`, async () => {
      const res = await fetch(`${BASE}${page}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const text = await res.text();
      if (!text.includes('<!DOCTYPE html>') && !text.includes('html')) {
        throw new Error('Not HTML response');
      }
    });
  }

  console.log(`\n======================================================`);
  console.log(`🏁 SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);
  if (failed > 0) process.exit(1);
}

runLiveTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
