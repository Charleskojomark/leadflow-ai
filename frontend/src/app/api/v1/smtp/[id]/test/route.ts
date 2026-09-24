import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await store.testSmtpConnection(Number(id));
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'SMTP connection failed' }, { status: 400 });
  }
}
