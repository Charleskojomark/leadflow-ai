import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.url) {
      return NextResponse.json({ detail: 'Target URL is required' }, { status: 400 });
    }
    const job = await store.scrapeUrl(body.url, body.list_id, body.auto_validate ?? true);
    return NextResponse.json(job);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Scrape failed' }, { status: 400 });
  }
}
