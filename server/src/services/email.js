import { Resend } from 'resend';
import { config } from '../config.js';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function sendVerificationEmail({ to, name, link }) {
  // No API key yet (local development): print the link instead of emailing it
  if (!resend) {
    console.log(`\n[email disabled] Verification link for ${to}:\n${link}\n`);
    return { skipped: true };
  }

  const subject = 'Verify your email for Study Together';
  const text =
    `Hi ${name},\n\n` +
    `Confirm your email address to finish creating your Study Together account:\n${link}\n\n` +
    `This link expires in 24 hours. If you didn't sign up, you can ignore this email.`;
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#17211f">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">Welcome to Study Together</h1>
      <p>Hi ${escapeHtml(name)}, confirm your email address to finish creating your account.</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#e0a94a;color:#1b1608;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Verify email</a>
      </p>
      <p style="font-size:13px;color:#5b6b66">Or paste this link into your browser:<br>${link}</p>
      <p style="font-size:13px;color:#5b6b66">This link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>
    </div>`;

  const { error } = await resend.emails.send({ from: config.emailFrom, to, subject, html, text });
  if (error) throw new Error(error.message || 'Resend could not send the email');
  return { skipped: false };
}