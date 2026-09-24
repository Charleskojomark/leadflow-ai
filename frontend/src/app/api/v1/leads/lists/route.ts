import { NextRequest, NextResponse } from 'next/server';
import { getLeadLists, createLeadList } from '@/lib/db';

export async function GET() {
  try {
    const lists = await getLeadLists();
    return NextResponse.json(lists);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ detail: 'List name is required' }, { status: 400 });
    }
    const list = await createLeadList({ name: body.name, description: body.description });
    return NextResponse.json(list, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Failed to create list' }, { status: 400 });
  }
}
