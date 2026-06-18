import nodemailer from 'nodemailer';
import pool from '../config/db.js';
import { decrypt, encrypt } from './cryptoService.js';
import { getTemplate } from './emailTemplates.js';

let transporterCache = {};

// TLS certificate verification stays ON. Only disabled with an explicit opt-in
// flag outside production (some self-hosted SMTP servers use self-signed certs).
const SMTP_REJECT_UNAUTHORIZED =
  !(process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_TLS === 'true');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Strip CR/LF (and surrounding whitespace) to prevent SMTP header injection.
function sanitizeHeader(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/[\r\n]+/g, ' ').trim();
}
// Validate a single recipient address.
function isValidEmail(addr) {
  return typeof addr === 'string' && EMAIL_RE.test(addr.trim());
}

/**
 * Load SMTP config from DB for a given company (or global if null)
 */
async function loadSMTPConfig(companyId = null) {
  try {
    let sql = 'SELECT * FROM email_config WHERE enabled = 1';
    const params = [];
    if (companyId) {
      sql += ' AND (company_id = ? OR company_id IS NULL) ORDER BY company_id DESC LIMIT 1';
      params.push(companyId);
    } else {
      sql += ' AND company_id IS NULL LIMIT 1';
    }
    const [[config]] = await pool.query(sql, params);
    if (!config) return null;

    // Decrypt SMTP password
    if (config.smtp_password_encrypted) {
      config.smtp_password = decrypt(config.smtp_password_encrypted, config.smtp_password_iv, config.smtp_password_tag);
    }
    return config;
  } catch (err) {
    console.error('Failed to load SMTP config:', err.message);
    return null;
  }
}

/**
 * Get or create a Nodemailer transporter for a company
 */
async function getTransporter(companyId = null) {
  const cacheKey = companyId || 'global';
  if (transporterCache[cacheKey]) return transporterCache[cacheKey];

  const config = await loadSMTPConfig(companyId);
  if (!config) {
    throw new Error('Email not configured. Please set up SMTP in Settings → Email Configuration.');
  }

  // Implicit TLS (SMTPS, `secure: true`) is only correct on port 465. On the
  // submission port 587 (and 25) the connection must start in plaintext and be
  // upgraded via STARTTLS — using `secure: true` there triggers the classic
  // "wrong version number" SSL error. Derive the mode from the port so the
  // connection is always encrypted regardless of how the UI flag is set.
  const port = Number(config.smtp_port) || 587;
  const secure = port === 465;
  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port,
    secure,
    requireTLS: !secure, // enforce STARTTLS on 587/25
    auth: {
      user: config.smtp_user,
      pass: config.smtp_password,
    },
    tls: { rejectUnauthorized: SMTP_REJECT_UNAUTHORIZED },
  });

  // Cache it with the from info
  transporterCache[cacheKey] = {
    transporter,
    from: `"${config.from_name || 'IST HR System'}" <${config.from_email || config.smtp_user}>`,
    replyTo: config.reply_to || config.from_email || config.smtp_user,
  };

  return transporterCache[cacheKey];
}

/**
 * Clear transporter cache (call after config changes)
 */
export function clearTransporterCache() {
  transporterCache = {};
}

/**
 * Log an email to the database
 */
async function logEmail({ companyId, toEmail, toName, fromEmail, subject, bodyHtml, templateType, relatedModule, relatedId, status, errorMessage, sentBy }) {
  try {
    await pool.query('INSERT INTO email_log SET ?', {
      company_id: companyId || null,
      to_email: toEmail,
      to_name: toName || null,
      from_email: fromEmail || null,
      subject,
      body_html: bodyHtml || null,
      template_type: templateType || null,
      related_module: relatedModule || null,
      related_id: relatedId || null,
      status: status || 'Sent',
      error_message: errorMessage || null,
      sent_by: sentBy || null,
    });
  } catch (err) {
    console.error('Failed to log email:', err.message);
  }
}

/**
 * Send a single email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.toName - Recipient name (for logging)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML body
 * @param {number} options.companyId - Company ID for SMTP config
 * @param {string} options.templateType - Template type for logging
 * @param {string} options.relatedModule - Related module (ATS, Onboarding, etc.)
 * @param {number} options.relatedId - Related record ID
 * @param {number} options.sentBy - User ID who triggered the send
 */
export async function sendEmail({ to, toName, subject, html, companyId, templateType, relatedModule, relatedId, sentBy }) {
  // Reject invalid recipients and neutralize header-injection attempts up front.
  if (!isValidEmail(to)) {
    return { success: false, error: 'Invalid recipient email address' };
  }
  const safeTo = to.trim();
  const safeName = sanitizeHeader(toName);
  const safeSubject = sanitizeHeader(subject);

  try {
    const { transporter, from, replyTo } = await getTransporter(companyId);

    const info = await transporter.sendMail({
      from,
      replyTo,
      to: safeName ? { name: safeName, address: safeTo } : safeTo,
      subject: safeSubject,
      html,
    });

    console.log(`📧 Email sent to ${safeTo}: ${safeSubject} [${info.messageId}]`);

    await logEmail({
      companyId, toEmail: safeTo, toName: safeName, fromEmail: from, subject: safeSubject, bodyHtml: html,
      templateType, relatedModule, relatedId, status: 'Sent', sentBy,
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed to ${safeTo}:`, err.message);

    await logEmail({
      companyId, toEmail: safeTo, toName: safeName, fromEmail: null, subject: safeSubject, bodyHtml: html,
      templateType, relatedModule, relatedId, status: 'Failed',
      errorMessage: err.message, sentBy,
    });

    return { success: false, error: err.message };
  }
}

/**
 * Send an email using a predefined template
 */
export async function sendTemplateEmail({ templateType, data, to, toName, companyId, relatedModule, relatedId, sentBy }) {
  const { subject, html } = getTemplate(templateType, data);
  return sendEmail({ to, toName, subject, html, companyId, templateType, relatedModule, relatedId, sentBy });
}

/**
 * Send bulk emails (same template, different recipients)
 */
export async function sendBulkEmail({ templateType, data, recipients, companyId, relatedModule, sentBy }) {
  const results = [];
  for (const recipient of recipients) {
    const personalData = { ...data, name: recipient.name || data.name };
    const result = await sendTemplateEmail({
      templateType, data: personalData,
      to: recipient.email, toName: recipient.name,
      companyId, relatedModule, relatedId: recipient.id, sentBy,
    });
    results.push({ email: recipient.email, ...result });
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  return results;
}

/**
 * Test SMTP connection
 */
export async function testSMTPConnection(companyId = null) {
  try {
    const { transporter } = await getTransporter(companyId);
    await transporter.verify();
    return { success: true, message: 'SMTP connection successful!' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Test SMTP with raw config (before saving)
 */
export async function testSMTPWithConfig(config) {
  try {
    // If the password field was left blank (kept existing), fall back to the
    // stored, decrypted password so "Test Connection" works without retyping.
    let { smtp_host, smtp_user, smtp_password, smtp_port } = config;
    if (!smtp_password) {
      const stored = await loadSMTPConfig(config.company_id || null);
      if (stored) {
        smtp_password = stored.smtp_password;
        smtp_host = smtp_host || stored.smtp_host;
        smtp_user = smtp_user || stored.smtp_user;
        smtp_port = smtp_port || stored.smtp_port;
      }
    }
    if (!smtp_password) {
      return { success: false, message: 'SMTP password is required. Please enter the email account password.' };
    }
    // Same port-derived TLS logic as getTransporter: implicit TLS only on 465,
    // STARTTLS on 587/25 — avoids the "wrong version number" SSL error.
    const port = Number(smtp_port) || 587;
    const secure = port === 465;
    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port,
      secure,
      requireTLS: !secure,
      auth: { user: smtp_user, pass: smtp_password },
      tls: { rejectUnauthorized: SMTP_REJECT_UNAUTHORIZED },
    });
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified!' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Save SMTP config to DB
 */
export async function saveEmailConfig(config, companyId = null) {
  // Verify the SMTP connection before persisting, so we never store a broken
  // configuration that silently fails later (WF-011). We can only verify when a
  // password is supplied (field-only updates that omit the password skip the
  // check). Pass skip_verify=true to override.
  if (config.enabled !== false && config.skip_verify !== true && config.smtp_host && config.smtp_password) {
    const verified = await testSMTPWithConfig(config);
    if (!verified.success) {
      throw new Error(`SMTP verification failed — config not saved: ${verified.message}`);
    }
  }

  const data = {
    company_id: companyId,
    smtp_host: config.smtp_host,
    smtp_port: config.smtp_port,
    smtp_secure: config.smtp_secure ? 1 : 0,
    smtp_user: config.smtp_user,
    from_name: config.from_name,
    from_email: config.from_email,
    reply_to: config.reply_to,
    enabled: config.enabled !== false ? 1 : 0,
  };

  // Encrypt password if provided
  if (config.smtp_password) {
    const { encrypted, iv, tag } = encrypt(config.smtp_password);
    data.smtp_password_encrypted = encrypted;
    data.smtp_password_iv = iv;
    data.smtp_password_tag = tag;
  }

  // Upsert: update if exists, insert if not
  const [[existing]] = await pool.query(
    'SELECT id FROM email_config WHERE company_id <=> ?', [companyId]
  );

  if (existing) {
    await pool.query('UPDATE email_config SET ? WHERE id = ?', [data, existing.id]);
  } else {
    await pool.query('INSERT INTO email_config SET ?', data);
  }

  clearTransporterCache();
  return { success: true };
}

/**
 * Get email config for a company
 */
export async function getEmailConfig(companyId = null) {
  const [[config]] = await pool.query(
    `SELECT id, company_id, smtp_host, smtp_port, smtp_secure, smtp_user,
            from_name, from_email, reply_to, enabled,
            (smtp_password_encrypted IS NOT NULL) AS has_password
       FROM email_config WHERE company_id <=> ?`,
    [companyId]
  );
  if (config) config.has_password = !!config.has_password;
  return config || null;
}
