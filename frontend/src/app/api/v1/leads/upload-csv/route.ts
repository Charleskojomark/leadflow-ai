import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/serverless-store';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const listId = formData.get('list_id') ? Number(formData.get('list_id')) : undefined;

    if (!file) {
      return NextResponse.json({ detail: 'No CSV file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/["\r]/g, '').trim());
      if (cols[0] && cols[0].includes('@')) {
        store.createLead({
          email: cols[0],
          first_name: cols[1] || 'Contact',
          last_name: cols[2] || '',
          company_name: cols[3] || 'Imported Corp',
          job_title: cols[4] || 'Executive',
          website: cols[5] || '',
          list_id: listId || 1,
        });
        imported++;
      }
    }

    return NextResponse.json({ imported, failed: 0 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'CSV upload failed' }, { status: 400 });
  }
}
