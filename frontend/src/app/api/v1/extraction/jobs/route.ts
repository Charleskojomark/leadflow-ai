import { NextResponse } from 'next/server';
import { isDbConfigured, getSql } from '@/lib/db';

export async function GET() {
  if (isDbConfigured()) {
    try {
      const sql = getSql();
      const rows = await sql`SELECT * FROM extraction_jobs ORDER BY created_at DESC LIMIT 20;`;
      return NextResponse.json(rows);
    } catch (err: any) {
      return NextResponse.json({ detail: err.message }, { status: 500 });
    }
  }

  return NextResponse.json([]);
}
