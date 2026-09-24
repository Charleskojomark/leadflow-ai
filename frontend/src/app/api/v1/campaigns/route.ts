import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function GET() {
  const campaigns = store.getCampaigns();
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ detail: 'Campaign name is required' }, { status: 400 });
    }
    const campaign = store.createCampaign(body);
    return NextResponse.json(campaign, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Failed to create campaign' }, { status: 400 });
  }
}
