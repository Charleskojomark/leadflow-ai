import { NextRequest, NextResponse } from 'next/server';
import { store, encryptCredential } from '@/lib/serverless-store';

export async function GET() {
  const accounts = store.getSmtpAccounts();
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.password) {
      // Encrypt password before saving
      body.encrypted_password = encryptCredential(body.password);
      delete body.password;
    }
    const account = store.createSmtpAccount(body);
    return NextResponse.json(account, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Failed to create SMTP account' }, { status: 400 });
  }
}
