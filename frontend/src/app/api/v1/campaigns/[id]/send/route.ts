import { NextRequest, NextResponse } from 'next/server';
import { isDbConfigured, getSql, getSmtpAccountRaw, updateCampaign, isEmailSuppressed, logActivity } from '@/lib/db';
import { sendOutreachEmail } from '@/lib/mailer';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const campId = Number(id);

    if (!isDbConfigured()) {
      return NextResponse.json({
        success: false,
        message: 'DATABASE_URL is not configured. Please connect your Neon DB to send real campaigns.',
      }, { status: 400 });
    }

    const sql = getSql();

    // 1. Fetch Campaign
    const [campaign] = await sql`SELECT * FROM campaigns WHERE id = ${campId};`;
    if (!campaign) {
      return NextResponse.json({ detail: 'Campaign not found' }, { status: 404 });
    }

    if (!campaign.smtp_account_id) {
      return NextResponse.json({ detail: 'Campaign does not have an active SMTP mailbox assigned' }, { status: 400 });
    }

    // 2. Fetch SMTP Account with decrypted password
    const smtpData = await getSmtpAccountRaw(campaign.smtp_account_id);
    if (!smtpData || !smtpData.account.is_active) {
      return NextResponse.json({ detail: 'Assigned SMTP account is not found or inactive' }, { status: 400 });
    }

    // 3. Fetch Campaign Step 1
    const steps = await sql`SELECT * FROM campaign_steps WHERE campaign_id = ${campId} ORDER BY step_number ASC;`;
    if (steps.length === 0) {
      return NextResponse.json({ detail: 'Campaign has no steps or message templates configured' }, { status: 400 });
    }
    const currentStep = steps[0];

    // 4. Fetch leads from the campaign's list
    let leads: any[] = [];
    if (campaign.lead_list_id) {
      leads = await sql`
        SELECT * FROM leads 
        WHERE list_id = ${campaign.lead_list_id} 
          AND status != 'bounced' 
          AND status != 'unsubscribed'
          AND validation_status != 'invalid'
        LIMIT 50;
      `;
    }

    if (leads.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No valid recipients found in the attached contact list.',
      }, { status: 400 });
    }

    // Mark campaign as running
    await updateCampaign(campId, { status: 'running' });

    let sent = 0;
    let failed = 0;
    let suppressed = 0;

    for (const lead of leads) {
      // Check suppression rule
      const suppressedCheck = await isEmailSuppressed(lead.email);
      if (suppressedCheck) {
        suppressed++;
        continue;
      }

      try {
        const sendResult = await sendOutreachEmail(
          smtpData.account,
          smtpData.decrypted_pass,
          lead,
          currentStep.subject,
          currentStep.body_template
        );

        sent++;

        // Log to campaign_logs
        await sql`
          INSERT INTO campaign_logs (campaign_id, lead_id, lead_email, step_number, status, message_id)
          VALUES (${campId}, ${lead.id}, ${lead.email}, ${currentStep.step_number}, 'sent', ${sendResult.messageId || null});
        `;

        // Update lead status
        await sql`UPDATE leads SET status = 'contacted', updated_at = NOW() WHERE id = ${lead.id};`;
      } catch (err: any) {
        failed++;
        await sql`
          INSERT INTO campaign_logs (campaign_id, lead_id, lead_email, step_number, status, error_message)
          VALUES (${campId}, ${lead.id}, ${lead.email}, ${currentStep.step_number}, 'failed', ${err.message || 'SMTP send failure'});
        `;
      }
    }

    // Update campaign counters
    const newSentCount = (campaign.sent_count || 0) + sent;
    await sql`
      UPDATE campaigns 
      SET sent_count = ${newSentCount}, status = 'completed', updated_at = NOW()
      WHERE id = ${campId};
    `;

    // Update SMTP daily count
    await sql`
      UPDATE smtp_accounts 
      SET emails_sent_today = emails_sent_today + ${sent}
      WHERE id = ${smtpData.account.id};
    `;

    await logActivity(
      'CAMPAIGN_EXECUTED',
      'campaign',
      `Campaign "${campaign.name}" dispatched: ${sent} sent, ${failed} failed, ${suppressed} suppressed.`
    );

    return NextResponse.json({
      success: true,
      campaign_id: campId,
      dispatched: sent,
      failed,
      suppressed,
      message: `Dispatched ${sent} emails via ${smtpData.account.host}.`,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || 'Campaign execution failed' }, { status: 500 });
  }
}
