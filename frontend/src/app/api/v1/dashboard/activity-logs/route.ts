import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get('limit')) || 20;
  const logs = store.getLogs(limit);
  return NextResponse.json(logs);
}
