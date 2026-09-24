import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.query) {
      return NextResponse.json({ detail: 'Search query is required' }, { status: 400 });
    }
    const job = await store.searchDiscovery(
      body.query,
      body.num_results || 5,
      body.list_id,
      body.auto_validate ?? true
    );
    return NextResponse.json(job);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Discovery failed' }, { status: 400 });
  }
}
