import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await store.validateLead(Number(id));
    return NextResponse.json(detail);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Validation failed' }, { status: 400 });
  }
}
