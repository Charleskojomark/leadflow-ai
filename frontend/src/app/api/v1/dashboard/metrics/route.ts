import { NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function GET() {
  const metrics = store.getMetrics();
  return NextResponse.json(metrics);
}
