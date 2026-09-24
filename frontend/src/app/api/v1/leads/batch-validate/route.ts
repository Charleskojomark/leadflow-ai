import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured, getSql, updateLead, logActivity } from '@/lib/db';
import { verifyEmailAddress } from '@/lib/verifier';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leadIds: number[] = body.lead_ids || [];

    if (leadIds.length === 0) {
      return NextResponse.json({ message: 'No leads provided', total_processed: 0, valid: 0, risky: 0, invalid: 0 });
    }

    let leadsToVerify: Array<{ id: number; email: string }> = [];

    if (isDbConfigured()) {
      const sql = getSql();
      const rows = await sql`
        SELECT id, email FROM leads WHERE id = ANY(${leadIds}::int[]);
      `;
      leadsToVerify = rows.map((r: any) => ({ id: r.id, email: r.email }));
    }

    let validCount = 0;
    let riskyCount = 0;
    let invalidCount = 0;

    for (const lead of leadsToVerify) {
      const result = await verifyEmailAddress(lead.email);
      if (result.status === 'valid') validCount++;
      else if (result.status === 'risky') riskyCount++;
      else invalidCount++;

      await updateLead(lead.id, {
        validation_status: result.status,
        deliverability_score: result.score,
      });
    }

    await logActivity(
      'BATCH_VALIDATED',
      'verification',
      `Batch verified ${leadsToVerify.length} contacts: ${validCount} Valid, ${riskyCount} Risky, ${invalidCount} Invalid`
    );

    return NextResponse.json({
      message: 'Batch verification complete',
      total_processed: leadsToVerify.length,
      valid: validCount,
      risky: riskyCount,
      invalid: invalidCount,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Batch validation failed' }, { status: 400 });
  }
}
