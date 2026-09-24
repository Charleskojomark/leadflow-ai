import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsiteLeads } from '@/lib/extractor';
import { createExtractionJob, updateExtractionJob, createLead, logActivity } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.url) {
      return NextResponse.json({ detail: 'Target URL is required' }, { status: 400 });
    }

    const job = await createExtractionJob('url_scrape', body.url);

    try {
      // Execute REAL web scrape using Cheerio
      const scrapeResult = await scrapeWebsiteLeads(body.url, body.list_id ? Number(body.list_id) : undefined);

      const createdLeads = [];
      for (const leadData of scrapeResult.leads) {
        try {
          const lead = await createLead(leadData);
          createdLeads.push(lead);
        } catch {
          // Ignore duplicate email errors
        }
      }

      await updateExtractionJob(job.id, 'completed', createdLeads.length);
      await logActivity('LEAD_DISCOVERED', 'discovery', `Scraped ${createdLeads.length} leads from ${body.url}`);

      return NextResponse.json({
        ...job,
        status: 'completed',
        leads_found: createdLeads.length,
        results: createdLeads,
        metadata: {
          title: scrapeResult.title,
          company: scrapeResult.company_name,
          socials: scrapeResult.socials,
        },
      });
    } catch (scrapeErr: any) {
      await updateExtractionJob(job.id, 'failed', 0);
      return NextResponse.json(
        { detail: `Web scraping failed: ${scrapeErr.message}` },
        { status: 502 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Scrape request failed' }, { status: 400 });
  }
}
