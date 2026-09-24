import nodemailer from 'nodemailer';
import { SmtpAccount, Lead } from './types';

export interface SendEmailPayload {
  to: string;
  subject: string;
  htmlContent: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  unsubscribeUrl?: string;
}

export function createSmtpTransporter(account: SmtpAccount, password: string) {
  return nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.port === 465 || account.use_ssl,
    auth: {
      user: account.username,
      pass: password,
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert blocks on custom enterprise relays
    },
  });
}

/**
 * Real SMTP connection verification
 */
export async function testSmtpConnection(
  account: SmtpAccount,
  password: string
): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createSmtpTransporter(account, password);
    await transporter.verify();
    return {
      success: true,
      message: `SMTP connection established successfully to ${account.host}:${account.port}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `SMTP Handshake failed: ${err.message || 'Unknown network error'}`,
    };
  }
}

/**
 * Real email dispatch with variable interpolation
 */
export async function sendOutreachEmail(
  account: SmtpAccount,
  password: string,
  lead: Lead,
  subjectTemplate: string,
  bodyTemplate: string,
  unsubscribeBaseUrl = 'https://leadflow.ai/api/v1/public/unsubscribe'
) {
  const transporter = createSmtpTransporter(account, password);

  // Variable interpolation: {{first_name}}, {{company_name}}, etc.
  const interpolate = (template: string) => {
    return template
      .replace(/{{\s*first_name\s*}}/gi, lead.first_name || 'there')
      .replace(/{{\s*last_name\s*}}/gi, lead.last_name || '')
      .replace(/{{\s*full_name\s*}}/gi, lead.full_name || lead.first_name || 'there')
      .replace(/{{\s*company_name\s*}}/gi, lead.company_name || 'your company')
      .replace(/{{\s*company\s*}}/gi, lead.company_name || 'your company')
      .replace(/{{\s*job_title\s*}}/gi, lead.job_title || 'leader')
      .replace(/{{\s*email\s*}}/gi, lead.email);
  };

  const subject = interpolate(subjectTemplate);
  let html = interpolate(bodyTemplate);

  const unsubUrl = `${unsubscribeBaseUrl}?email=${encodeURIComponent(lead.email)}`;

  // Append compliance footer
  html += `
    <br><br>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="font-size: 11px; color: #64748b; line-height: 1.5; font-family: sans-serif;">
      You received this communication because your professional contact information is publicly listed.
      <br>
      To opt out of future messages, <a href="${unsubUrl}" style="color: #3b82f6; text-decoration: underline;">click here to unsubscribe</a>.
    </p>
  `;

  const mailOptions = {
    from: `"${account.from_name || account.username}" <${account.from_email}>`,
    to: lead.email,
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'X-Mailer': 'LeadFlow AI Outreach Engine v2.0',
    },
  };

  const result = await transporter.sendMail(mailOptions);
  return {
    success: true,
    messageId: result.messageId,
    response: result.response,
  };
}
