import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured, getSql } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDbConfigured()) {
    const sql = getSql();
    await sql`DELETE FROM suppression_rules WHERE id = ${Number(id)};`;
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: true });
}
