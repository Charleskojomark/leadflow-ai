import { NextRequest, NextResponse } from 'next/server';
import { createLead, isEmailSuppressed, logActivity } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const listId = formData.get('list_id') ? Number(formData.get('list_id')) : undefined;

    if (!file) {
      return NextResponse.json({ detail: 'No CSV file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return NextResponse.json({ detail: 'CSV file is empty or missing headers' }, { status: 400 });
    }

    // Parse header row
    const headers = lines[0].split(',').map((h) => h.replace(/["\r]/g, '').trim().toLowerCase());
    const emailIdx = headers.findIndex((h) => h.includes('email'));
    const firstNameIdx = headers.findIndex((h) => h.includes('first') || h === 'name');
    const lastNameIdx = headers.findIndex((h) => h.includes('last'));
    const companyIdx = headers.findIndex((h) => h.includes('company') || h.includes('org'));
    const titleIdx = headers.findIndex((h) => h.includes('title') || h.includes('role') || h.includes('job'));
    const websiteIdx = headers.findIndex((h) => h.includes('website') || h.includes('domain') || h.includes('url'));
    const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile'));

    if (emailIdx === -1) {
      return NextResponse.json({ detail: 'CSV must contain an "Email" column' }, { status: 400 });
    }

    let imported = 0;
    let suppressed = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle simple CSV splitting
      const cols = line.split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
      const email = cols[emailIdx]?.toLowerCase().trim();

      if (!email || !email.includes('@')) {
        skipped++;
        continue;
      }

      // Check suppression table
      const isSupp = await isEmailSuppressed(email);
      if (isSupp) {
        suppressed++;
        continue;
      }

      const firstName = firstNameIdx !== -1 ? cols[firstNameIdx] : '';
      const lastName = lastNameIdx !== -1 ? cols[lastNameIdx] : '';
      const company = companyIdx !== -1 ? cols[companyIdx] : '';
      const title = titleIdx !== -1 ? cols[titleIdx] : '';
      const website = websiteIdx !== -1 ? cols[websiteIdx] : '';
      const phone = phoneIdx !== -1 ? cols[phoneIdx] : '';

      try {
        await createLead({
          email,
          first_name: firstName,
          last_name: lastName,
          company_name: company,
          job_title: title,
          website,
          phone,
          source: 'csv_upload',
          list_id: listId,
        });
        imported++;
      } catch (err) {
        skipped++;
      }
    }

    await logActivity('CSV_IMPORTED', 'leads', `Imported ${imported} leads from CSV (${suppressed} suppressed, ${skipped} skipped)`);

    return NextResponse.json({
      imported,
      suppressed,
      failed: skipped,
      message: `Successfully processed CSV: ${imported} leads imported.`,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'CSV upload failed' }, { status: 400 });
  }
}
