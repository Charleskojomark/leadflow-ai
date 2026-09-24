import { NextRequest, NextResponse } from 'next/server';
import { updateLead, isDbConfigured, getSql } from '@/lib/db';
import { verifyEmailAddress } from '@/lib/verifier';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const leadId = Number(id);

    let email = '';
    if (isDbConfigured()) {
      const sql = getSql();
      const [row] = await sql`SELECT email FROM leads WHERE id = ${leadId};`;
      if (!row) {
        return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
      }
      email = row.email;
    } else {
      // In-memory or direct body
      const body = await req.json().catch(() => ({}));
      email = body.email || 'lead@example.com';
    }

    // Perform REAL multi-step verification: RFC 5322 regex + DNS MX resolution + burner check
    const validation = await verifyEmailAddress(email);

    // Save updated validation status & deliverability score to DB
    await updateLead(leadId, {
      validation_status: validation.status,
      deliverability_score: validation.score,
    });

    return NextResponse.json(validation);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Validation failed' }, { status: 400 });
  }
}
