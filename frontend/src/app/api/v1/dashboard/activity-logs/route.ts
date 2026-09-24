import { NextRequest, NextResponse } from 'next/server';
import { getActivityLogs } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get('limit') || '10');
    const logs = await getActivityLogs(limit);
    return NextResponse.json(logs);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
