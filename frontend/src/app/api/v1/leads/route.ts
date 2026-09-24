import { NextRequest, NextResponse } from 'next/server';
import { getLeads, createLead } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const list_id = searchParams.get('list_id') ? Number(searchParams.get('list_id')) : undefined;
  const validation_status = searchParams.get('validation_status') || undefined;
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;
  const skip = searchParams.get('skip') ? Number(searchParams.get('skip')) : 0;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100;

  try {
    const result = await getLeads({
      list_id,
      validation_status,
      status,
      search,
      skip,
      limit,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.email) {
      return NextResponse.json({ detail: 'Email is required' }, { status: 400 });
    }
    const lead = await createLead(body);
    return NextResponse.json(lead, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Failed to create lead' }, { status: 400 });
  }
}
