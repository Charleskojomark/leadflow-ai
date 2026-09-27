import { NextRequest, NextResponse } from 'next/server';
import { updateLead, deleteLead, getLeadById } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(Number(id));
  if (!lead) {
    return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
  }
  return NextResponse.json(lead);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await updateLead(Number(id), body);
    if (!updated) {
      return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Failed to update lead' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const success = await deleteLead(Number(id));
  if (!success) {
    return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
