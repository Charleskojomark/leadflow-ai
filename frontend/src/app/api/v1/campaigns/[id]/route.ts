import { NextRequest, NextResponse } from 'next/server';
import { updateCampaign, isDbConfigured, getSql } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campId = Number(id);

  if (isDbConfigured()) {
    const sql = getSql();
    const [row] = await sql`
      SELECT c.*, smtp.name AS smtp_account_name, lists.name AS lead_list_name
      FROM campaigns c
      LEFT JOIN smtp_accounts smtp ON smtp.id = c.smtp_account_id
      LEFT JOIN lead_lists lists ON lists.id = c.lead_list_id
      WHERE c.id = ${campId};
    `;
    if (!row) {
      return NextResponse.json({ detail: 'Campaign not found' }, { status: 404 });
    }

    const steps = await sql`SELECT * FROM campaign_steps WHERE campaign_id = ${campId} ORDER BY step_number ASC;`;
    return NextResponse.json({ ...row, steps });
  }

  return NextResponse.json({ id: campId, name: 'Campaign', status: 'draft' });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await updateCampaign(Number(id), body);
    if (!updated) {
      return NextResponse.json({ detail: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDbConfigured()) {
    const sql = getSql();
    await sql`DELETE FROM campaigns WHERE id = ${Number(id)};`;
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: true });
}
