import nodemailer from 'nodemailer';

// Support both naming conventions: SMTP_* (local) and EMAIL_* (Vercel)
const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
const smtpPort = process.env.SMTP_PORT || process.env.EMAIL_PORT || '587';
const smtpSecure = process.env.SMTP_SECURE || process.env.EMAIL_SECURE || 'false';

// Check if email is configured
const hasEmailConfig = smtpHost && smtpUser && smtpPass;

let transporter = null;

if (hasEmailConfig) {
  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpSecure === 'true', // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
    console.log('Email service initialized');
  } catch (error) {
    console.warn('Failed to initialize email service:', error.message);
  }
} else {
  console.log('Email not configured - email notifications will be disabled');
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text email body
 * @param {string} [options.html] - HTML email body (optional)
 * @param {string} [options.from] - Sender email address (defaults to SMTP_USER)
 * @returns {Promise} - Promise that resolves when email is sent
 */
export async function sendEmail({ to, subject, text, html, from }) {
  if (!transporter) {
    throw new Error('Email service not configured. Please set SMTP_HOST (or EMAIL_HOST), SMTP_USER (or EMAIL_USER), and SMTP_PASS (or EMAIL_PASS) environment variables.');
  }

  if (!to) {
    throw new Error('Recipient email address is required');
  }

  try {
    const mailOptions = {
      from: from || smtpUser,
      to: to,
      subject: subject,
      text: text,
      ...(html && { html: html })
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Check if email service is configured
 * @returns {boolean}
 */
export function isEmailConfigured() {
  return hasEmailConfig && transporter !== null;
}

