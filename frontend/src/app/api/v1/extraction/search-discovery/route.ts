import { NextRequest, NextResponse } from 'next/server';
import { createExtractionJob, updateExtractionJob, createLead, logActivity } from '@/lib/db';
import { scrapeWebsiteLeads } from '@/lib/extractor';

/**
 * Detects whether a string is a boolean/Google search operator query rather than a URL.
 * Patterns like: "VP Sales" OR "Founder", site:linkedin.com/in, intitle:, inurl:, etc.
 */
function isBooleanSearchQuery(query: string): boolean {
  const booleanPatterns = [
    /\bOR\b/,
    /\bAND\b/,
    /\bNOT\b/,
    /site:/i,
    /intitle:/i,
    /inurl:/i,
    /intext:/i,
    /filetype:/i,
    /"[^"]+"\s+OR\s+"[^"]+"/i,
    /"[^"]+"\s+AND\s+"[^"]+"/i,
  ];
  return booleanPatterns.some((pattern) => pattern.test(query));
}

/**
 * Extracts a standalone target domain/URL from the query — but only if it's NOT
 * inside a boolean operator like `site:domain.com`.
 */
function extractStandaloneDomain(query: string): string | null {
  // Remove boolean operators and quoted strings to isolate bare domains
  const stripped = query
    .replace(/site:[^\s]+/gi, '')      // remove site: operators
    .replace(/intitle:[^\s]+/gi, '')   // remove intitle: operators
    .replace(/inurl:[^\s]+/gi, '')     // remove inurl: operators
    .replace(/"[^"]*"/g, '')           // remove quoted phrases
    .replace(/\b(OR|AND|NOT)\b/g, '') // remove boolean words
    .trim();

  // Now look for a standalone URL or domain in what's left
  const urlMatch = stripped.match(
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i
  );

  return urlMatch ? urlMatch[0] : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.query) {
      return NextResponse.json({ detail: 'Search query is required' }, { status: 400 });
    }

    const query = body.query.trim();
    const job = await createExtractionJob('search_discovery', query);

    // If this looks like a boolean / Google search operator query,
    // do NOT attempt to scrape it as a URL — return an instructional response.
    if (isBooleanSearchQuery(query)) {
      await updateExtractionJob(job.id, 'completed', 0);
      await logActivity(
        'SEARCH_SIMULATED',
        'discovery',
        `Boolean query simulated: "${query}"`
      );
      return NextResponse.json({
        ...job,
        status: 'completed',
        leads_found: 0,
        results: [],
        message:
          'Boolean/Google search operator query received. To extract real contacts, ' +
          'switch to the "Target Website Scraper" tab and enter a direct company domain ' +
          '(e.g. stripe.com or https://linear.app). The Search Query Simulator maps ' +
          'your Boolean logic to target domains — paste a company website to begin extraction.',
      });
    }

    // Otherwise, try to extract a standalone domain from the query
    const targetUrl = extractStandaloneDomain(query);

    if (targetUrl) {
      try {
        const scrapeResult = await scrapeWebsiteLeads(
          targetUrl,
          body.list_id ? Number(body.list_id) : undefined
        );
        const createdLeads = [];
        for (const leadData of scrapeResult.leads) {
          try {
            const lead = await createLead(leadData);
            createdLeads.push(lead);
          } catch {
            // Dedupe — ignore duplicate email errors
          }
        }

        await updateExtractionJob(job.id, 'completed', createdLeads.length);
        await logActivity(
          'LEAD_DISCOVERED',
          'discovery',
          `Discovered ${createdLeads.length} contacts for "${query}"`
        );

        return NextResponse.json({
          ...job,
          status: 'completed',
          leads_found: createdLeads.length,
          results: createdLeads,
        });
      } catch (err: any) {
        await updateExtractionJob(job.id, 'failed', 0);
        return NextResponse.json(
          { detail: `Discovery failed: ${err.message}` },
          { status: 502 }
        );
      }
    }

    // No domain found at all
    await updateExtractionJob(job.id, 'completed', 0);
    return NextResponse.json({
      ...job,
      status: 'completed',
      leads_found: 0,
      results: [],
      message:
        'No target domain found in query. Please provide a company domain ' +
        '(e.g. stripe.com or https://linear.app) to extract contacts.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || 'Discovery failed' },
      { status: 400 }
    );
  }
}
