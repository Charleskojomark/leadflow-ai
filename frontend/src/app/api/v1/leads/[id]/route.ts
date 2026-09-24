import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = store.getLead(Number(id));
  if (!lead) {
    return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
  }
  return NextResponse.json(lead);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = store.updateLead(Number(id), body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Failed to update lead' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const success = store.deleteLead(Number(id));
  if (!success) {
    return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
