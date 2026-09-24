import { NextRequest, NextResponse } from 'next/server';
import { getSmtpAccounts, createSmtpAccount, encryptCredential } from '@/lib/db';

export async function GET() {
  try {
    const accounts = await getSmtpAccounts();
    return NextResponse.json(accounts);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.host || !body.username || !body.from_email) {
      return NextResponse.json({ detail: 'Host, username, and from_email are required' }, { status: 400 });
    }

    if (body.password) {
      body.encrypted_password = encryptCredential(body.password);
      delete body.password;
    }

    const account = await createSmtpAccount(body);
    return NextResponse.json(account, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Failed to create SMTP account' }, { status: 400 });
  }
}
