import { NextRequest, NextResponse } from 'next/server';
import { createExtractionJob, updateExtractionJob, createLead, logActivity } from '@/lib/db';
import { scrapeWebsiteLeads } from '@/lib/extractor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.query) {
      return NextResponse.json({ detail: 'Search query is required' }, { status: 400 });
    }

    const job = await createExtractionJob('search_discovery', body.query);

    // If query contains a URL or domain, scrape it directly
    const query = body.query.trim();
    const domainMatch = query.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i);

    if (domainMatch) {
      const targetUrl = domainMatch[0];
      try {
        const scrapeResult = await scrapeWebsiteLeads(targetUrl, body.list_id ? Number(body.list_id) : undefined);
        const createdLeads = [];
        for (const leadData of scrapeResult.leads) {
          try {
            const lead = await createLead(leadData);
            createdLeads.push(lead);
          } catch {
            // dedupe
          }
        }

        await updateExtractionJob(job.id, 'completed', createdLeads.length);
        await logActivity('LEAD_DISCOVERED', 'discovery', `Discovered ${createdLeads.length} contacts for "${body.query}"`);

        return NextResponse.json({
          ...job,
          status: 'completed',
          leads_found: createdLeads.length,
          results: createdLeads,
        });
      } catch (err: any) {
        await updateExtractionJob(job.id, 'failed', 0);
        return NextResponse.json({ detail: `Discovery failed: ${err.message}` }, { status: 502 });
      }
    }

    // No direct domain found in query
    await updateExtractionJob(job.id, 'completed', 0);
    return NextResponse.json({
      ...job,
      status: 'completed',
      leads_found: 0,
      results: [],
      message: 'Please provide a target company domain (e.g. stripe.com or https://linear.app) for autonomous extraction.',
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Discovery failed' }, { status: 400 });
  }
}
