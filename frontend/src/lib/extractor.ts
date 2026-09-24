import * as cheerio from 'cheerio';
import { LeadCreateInput } from './types';
import { verifyEmailAddress } from './verifier';

export interface ScrapedResult {
  url: string;
  title: string;
  company_name: string;
  emails_found: string[];
  socials: {
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
  leads: Array<LeadCreateInput & { deliverability_score?: number; validation_status?: string }>;
}

export async function scrapeWebsiteLeads(targetUrl: string, listId?: number): Promise<ScrapedResult> {
  let url = targetUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname.replace('www.', '');

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 LeadFlowScraper/2.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(12000), // 12s timeout
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch website: HTTP ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract page title & inferred company name
  const pageTitle = $('title').text().trim() || domain;
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || '';
  const inferredCompany = ogSiteName || pageTitle.split(/[-–|:]/)[0].trim() || domain;

  // Extract socials
  const socials: ScrapedResult['socials'] = {};
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('linkedin.com/company/') || href.includes('linkedin.com/in/')) {
      socials.linkedin = href;
    } else if (href.includes('twitter.com/') || href.includes('x.com/')) {
      socials.twitter = href;
    } else if (href.includes('github.com/')) {
      socials.github = href;
    }
  });

  // Extract emails from mailto links
  const rawEmails = new Set<string>();
  $('a[href^="mailto:"]').each((_, el) => {
    const mailto = $(el).attr('href') || '';
    const email = mailto.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
    if (email && email.includes('@')) {
      rawEmails.add(email);
    }
  });

  // Extract emails from full page text regex
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  const matches = html.match(emailRegex) || [];
  for (const m of matches) {
    const clean = m.toLowerCase().trim();
    // Exclude common image extensions or script artifacts
    if (!clean.endsWith('.png') && !clean.endsWith('.jpg') && !clean.endsWith('.webp') && !clean.endsWith('.js') && !clean.endsWith('.css')) {
      rawEmails.add(clean);
    }
  }

  const emailsList = Array.from(rawEmails);

  // Build leads with real verification
  const leads: ScrapedResult['leads'] = [];
  for (const email of emailsList) {
    const [localPart] = email.split('@');
    // Try to infer name from local part (e.g. sarah.chen -> Sarah Chen)
    const nameParts = localPart.split(/[._-]/).filter(Boolean);
    const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : '';
    const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : '';

    const verification = await verifyEmailAddress(email);

    leads.push({
      email,
      first_name: firstName,
      last_name: lastName,
      company_name: inferredCompany,
      website: url,
      source: 'url_scraper',
      linkedin_url: socials.linkedin,
      twitter_url: socials.twitter,
      deliverability_score: verification.score,
      validation_status: verification.status,
      list_id: listId,
    });
  }

  return {
    url,
    title: pageTitle,
    company_name: inferredCompany,
    email_count: emailsList.length,
    emails_found: emailsList,
    socials,
    leads,
  } as any;
}
