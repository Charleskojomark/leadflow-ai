import { NextRequest, NextResponse } from 'next/server';
import { getSuppressionRules, createSuppressionRule } from '@/lib/db';

export async function GET() {
  try {
    const rules = await getSuppressionRules();
    return NextResponse.json(rules);
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.value) {
      return NextResponse.json({ detail: 'Rule value is required' }, { status: 400 });
    }
    const rule = await createSuppressionRule({
      rule_type: body.rule_type || 'email',
      value: body.value,
      reason: body.reason,
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Failed to create suppression rule' }, { status: 400 });
  }
}
