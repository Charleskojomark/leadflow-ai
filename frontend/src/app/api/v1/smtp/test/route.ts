import { NextRequest, NextResponse } from 'next/server';
import { testSmtpConnection } from '@/lib/mailer';

/**
 * Pre-Save SMTP Verification Endpoint
 * Validates host, port, TLS negotiation, and authentication credentials
 * without requiring the account to be persisted to the database first.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { host, port, username, password, use_ssl, use_tls } = body;

    if (!host || !username) {
      return NextResponse.json(
        {
          success: false,
          message: 'Host and Username/Email are required to test mailbox connection.',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Password or App Password is required to verify authentication.',
          code: 'MISSING_PASSWORD',
        },
        { status: 400 }
      );
    }

    const result = await testSmtpConnection(
      {
        host: String(host).trim(),
        port: Number(port) || 587,
        username: String(username).trim(),
        use_ssl: Boolean(use_ssl),
        use_tls: use_tls !== undefined ? Boolean(use_tls) : true,
      },
      String(password).trim()
    );

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err.message || 'An unexpected error occurred during SMTP verification.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
