import { NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function GET() {
  const jobs = store.getJobs();
  return NextResponse.json(jobs);
}
