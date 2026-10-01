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

export interface SmtpConfig {
  host: string;
  port: number;
  use_ssl?: boolean;
  use_tls?: boolean;
  username: string;
  from_name?: string;
  from_email?: string;
}

export function createSmtpTransporter(account: SmtpConfig, password: string) {
  return nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.port === 465 || Boolean(account.use_ssl),
    auth: {
      user: account.username,
      pass: password,
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert blocks on custom enterprise relays
    },
    connectionTimeout: 8000, // 8s connection timeout to prevent hanging serverless routes
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
}

/**
 * Real SMTP connection verification with comprehensive handshake diagnostics
 */
export async function testSmtpConnection(
  account: SmtpConfig,
  password: string
): Promise<{ success: boolean; message: string; code?: string }> {
  if (!account.host || !account.username) {
    return {
      success: false,
      message: 'SMTP Host and Username/Email are required.',
      code: 'MISSING_FIELDS',
    };
  }

  if (!password) {
    return {
      success: false,
      message: 'SMTP Password or App Password is required for authentication.',
      code: 'MISSING_PASSWORD',
    };
  }

  try {
    const transporter = createSmtpTransporter(account, password);
    await transporter.verify();
    return {
      success: true,
      message: `Handshake verified: Successfully connected to ${account.host}:${account.port} and authenticated as ${account.username}`,
      code: 'SUCCESS',
    };
  } catch (err: any) {
    const msg: string = err.message || '';
    let friendlyMessage = `SMTP Handshake failed: ${msg}`;

    if (
      msg.includes('535') ||
      msg.toLowerCase().includes('badcredentials') ||
      msg.toLowerCase().includes('authentication failed') ||
      msg.toLowerCase().includes('invalid login')
    ) {
      friendlyMessage = `Authentication Failed (535): Incorrect username or password. Note: For Google Workspace / Gmail, you must generate a 16-character "App Password" in Google Account Security, rather than your standard account password.`;
    } else if (
      msg.includes('ETIMEDOUT') ||
      msg.includes('greeting timeout') ||
      msg.includes('Connection timeout')
    ) {
      friendlyMessage = `Connection Timed Out: Unable to reach ${account.host} on port ${account.port}. Verify hostname and ensure outbound traffic on port ${account.port} is not blocked.`;
    } else if (msg.includes('ECONNREFUSED')) {
      friendlyMessage = `Connection Refused: Server at ${account.host} rejected connection on port ${account.port}.`;
    } else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
      friendlyMessage = `DNS Lookup Failed: Hostname "${account.host}" cannot be resolved. Please check for typos.`;
    } else if (msg.includes('wrong version number') || msg.includes('SSL routines')) {
      friendlyMessage = `SSL/TLS Protocol Mismatch: Port ${account.port} does not match the SSL/TLS configuration. Typically use port 587 with STARTTLS or port 465 with SSL.`;
    }

    return {
      success: false,
      message: friendlyMessage,
      code: err.code || 'SMTP_ERROR',
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
