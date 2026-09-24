import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'LeadFlow AI Serverless Platform',
    version: '2.0.0',
    architecture: '100% Serverless Vercel Edge/Node Functions',
    uptime: process.uptime(),
  });
}
