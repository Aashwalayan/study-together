import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
if (isProd && !process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY must be set in production (needed for email verification)');
}

const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const config = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/study-together',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  clientOrigins,
  isProd,

  // Email verification
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'Study Together <onboarding@resend.dev>',
  // Base URL used to build the link inside verification emails
  appUrl: (process.env.APP_URL || clientOrigins[0]).replace(/\/+$/, ''),
  verifyTokenTtlMs: 24 * 60 * 60 * 1000, // links stay valid for 24 hours
  resendCooldownMs: 60 * 1000, // at most one email per minute per account
};