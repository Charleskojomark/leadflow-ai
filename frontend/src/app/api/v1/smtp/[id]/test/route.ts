import { NextRequest, NextResponse } from 'next/server';
import { getSmtpAccountRaw } from '@/lib/db';
import { testSmtpConnection } from '@/lib/mailer';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await getSmtpAccountRaw(Number(id));

    if (!data) {
      return NextResponse.json({ detail: 'SMTP account not found' }, { status: 404 });
    }

    const { account, decrypted_pass } = data;

    // Real Nodemailer connection test with live SMTP server
    const result = await testSmtpConnection(account, decrypted_pass);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'SMTP connection failed' }, { status: 400 });
  }
}
