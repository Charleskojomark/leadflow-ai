import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function GET() {
  const lists = store.getLists();
  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ detail: 'List name is required' }, { status: 400 });
    }
    const list = store.createList(body.name, body.description);
    return NextResponse.json(list, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Failed to create list' }, { status: 400 });
  }
}
