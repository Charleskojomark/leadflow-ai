import { NextRequest, NextResponse } from 'next/server';
import { getSmtpAccounts, createSmtpAccount, encryptCredential } from '@/lib/db';
import { testSmtpConnection } from '@/lib/mailer';

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
      return NextResponse.json(
        { detail: 'Host, username, and from_email are required' },
        { status: 400 }
      );
    }

    let connectionStatus: 'verified' | 'untested' | 'failed' = 'untested';
    let lastError: string | undefined = undefined;

    // Optional or default handshake verification
    if (body.verify_connection && body.password) {
      const testResult = await testSmtpConnection(
        {
          host: body.host,
          port: Number(body.port) || 587,
          username: body.username,
          use_ssl: Boolean(body.use_ssl),
          use_tls: body.use_tls !== undefined ? Boolean(body.use_tls) : true,
        },
        body.password
      );

      if (!testResult.success && !body.force_save) {
        return NextResponse.json(
          {
            detail: `Mailbox connection failed: ${testResult.message}`,
            test_result: testResult,
          },
          { status: 422 }
        );
      }

      connectionStatus = testResult.success ? 'verified' : 'failed';
      lastError = testResult.success ? undefined : testResult.message;
    }

    const payload = { ...body };
    payload.connection_status = connectionStatus;
    payload.last_error = lastError;
    payload.last_tested_at = connectionStatus !== 'untested' ? new Date().toISOString() : undefined;

    if (payload.password) {
      payload.encrypted_password = encryptCredential(payload.password);
    }

    const account = await createSmtpAccount(payload);
    return NextResponse.json(account, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Failed to create SMTP account' }, { status: 400 });
  }
}

