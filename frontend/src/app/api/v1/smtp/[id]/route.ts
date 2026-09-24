import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const success = store.deleteSmtpAccount(Number(id));
  if (!success) {
    return NextResponse.json({ detail: 'Account not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
