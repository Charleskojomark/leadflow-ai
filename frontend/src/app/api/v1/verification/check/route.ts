import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailAddress } from '@/lib/verifier';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.email) {
      return NextResponse.json({ detail: 'Email is required' }, { status: 400 });
    }

    // Perform REAL live RFC 5322 regex + Node.js DNS MX record resolution + burner domain check
    const result = await verifyEmailAddress(body.email);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Verification failed' }, { status: 400 });
  }
}
