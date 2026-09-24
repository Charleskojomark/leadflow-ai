import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leadIds: number[] = body.lead_ids || [];
    const result = await store.batchValidateLeads(leadIds);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Batch validation failed' }, { status: 400 });
  }
}
