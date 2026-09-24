import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = store.getCampaign(Number(id));
  if (!campaign) {
    return NextResponse.json({ detail: 'Campaign not found' }, { status: 404 });
  }
  return NextResponse.json(campaign);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const success = store.deleteCampaign(Number(id));
  if (!success) {
    return NextResponse.json({ detail: 'Campaign not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
