import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';

export async function GET() {
  const dbConnected = isDbConfigured();

  return NextResponse.json({
    status: 'healthy',
    service: 'LeadFlow AI',
    version: '2.0.0',
    architecture: '100% Serverless Next.js App Router',
    database: {
      provider: 'Neon Serverless PostgreSQL',
      configured: dbConnected,
    },
    capabilities: [
      'Real Cheerio Web Scraper',
      'Real RFC 5322 + DNS MX Mailbox Verification',
      'Real Nodemailer SMTP Dispatch Engine',
      'Neon PostgreSQL Relational Persistence',
    ],
    timestamp: new Date().toISOString(),
  });
}
