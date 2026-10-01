import { NextRequest, NextResponse } from 'next/server';
import { getSmtpAccountRaw, updateSmtpAccountStatus } from '@/lib/db';
import { testSmtpConnection } from '@/lib/mailer';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const accountId = Number(id);
    const data = await getSmtpAccountRaw(accountId);

    if (!data) {
      return NextResponse.json({ success: false, message: 'SMTP account not found' }, { status: 404 });
    }

    const { account, decrypted_pass } = data;

    // Real Nodemailer connection test with live SMTP server
    const result = await testSmtpConnection(account, decrypted_pass);

    // Persist status back to the mailbox record
    await updateSmtpAccountStatus(
      accountId,
      result.success ? 'verified' : 'failed',
      result.success ? undefined : result.message
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'SMTP connection failed' },
      { status: 400 }
    );
  }
}

