import { NextRequest, NextResponse } from 'next/server';
import { deleteSmtpAccount, getSmtpAccountRaw } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSmtpAccountRaw(Number(id));
  if (!result) {
    return NextResponse.json({ detail: 'SMTP account not found' }, { status: 404 });
  }
  return NextResponse.json(result.account);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const success = await deleteSmtpAccount(Number(id));
  if (!success) {
    return NextResponse.json({ detail: 'SMTP account not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
