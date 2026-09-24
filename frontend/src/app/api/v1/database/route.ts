import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured, initDb, getDatabaseUrl, getSql } from '@/lib/db';

export async function GET() {
  const configured = isDbConfigured();
  const rawUrl = getDatabaseUrl();

  if (!configured) {
    return NextResponse.json({
      status: 'unconfigured',
      configured: false,
      message: 'DATABASE_URL is not set. Please add your Neon connection string in your environment variables or Vercel dashboard.',
    });
  }

  try {
    const sql = getSql();
    const [row] = await sql`SELECT NOW() AS current_time, current_database() AS db_name, version() AS pg_version;`;
    return NextResponse.json({
      status: 'connected',
      configured: true,
      database: row.db_name,
      server_time: row.current_time,
      version: row.pg_version,
      message: 'Successfully connected to Neon PostgreSQL.',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        configured: true,
        message: `Database connection error: ${err.message}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await initDb();
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
