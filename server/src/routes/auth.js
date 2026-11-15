import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { generateToken, hashToken } from '../utils/tokens.js';
import { sendVerificationEmail } from '../services/email.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (user) => jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '7d' });

const toPublic = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  subject: user.subject,
});

// Creates a fresh token (replacing any older one) and emails the link
async function issueVerification(user) {
  const token = generateToken();
  user.verifyTokenHash = hashToken(token);
  user.verifyTokenExpires = new Date(Date.now() + config.verifyTokenTtlMs);
  user.verifySentAt = new Date();
  await user.save();

  const link = `${config.appUrl}/verify-email?token=${token}`;
  await sendVerificationEmail({ to: user.email, name: user.name, link });
}

router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const subject = String(req.body.subject || '').trim().slice(0, 60);

    if (name.length < 2 || name.length > 40) {
      return res.status(400).json({ error: 'Name must be 2 to 40 characters' });
    }
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    if (await User.exists({ email })) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    try {
      user = await User.create({ name, email, passwordHash, subject });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      throw err;
    }

    // The account exists even if the email fails; the user can request another
    let emailSent = true;
    try {
      await issueVerification(user);
    } catch (err) {
      console.error('Could not send verification email:', err.message);
      emailSent = false;
    }

    // No session yet: the user must verify their email before signing in
    res.status(201).json({ needsVerification: true, email: user.email, emailSent });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const user = await User.findOne({ email });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before signing in',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    res.json({ token: signToken(user), user: toPublic(user) });
  } catch (err) {
    next(err);
  }
});

// Called by the /verify-email page (a POST, so mail scanners that pre-open
// links can't use up the token). A valid link also signs the user in.
router.post('/verify-email', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    const invalid = { error: 'This verification link is invalid or has expired' };
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json(invalid);

    const user = await User.findOne({
      verifyTokenHash: hashToken(token),
      verifyTokenExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json(invalid);

    user.emailVerified = true;
    user.verifyTokenHash = undefined;
    user.verifyTokenExpires = undefined;
    await user.save();

    res.json({ token: signToken(user), user: toPublic(user) });
  } catch (err) {
    next(err);
  }
});

// Always answers the same way, so it can't be used to discover which emails
// have accounts. A cooldown stops people from spamming an inbox.
router.post('/resend-verification', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });

    const user = await User.findOne({ email });
    if (user && !user.emailVerified) {
      const sinceLast = user.verifySentAt ? Date.now() - user.verifySentAt.getTime() : Infinity;
      if (sinceLast >= config.resendCooldownMs) {
        try {
          await issueVerification(user);
        } catch (err) {
          console.error('Could not send verification email:', err.message);
        }
      }
    }

    res.json({ message: 'If that account exists and is not verified yet, a new email is on its way.' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ user: toPublic(user) });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const update = {};
    if (typeof req.body.subject === 'string') update.subject = req.body.subject.trim().slice(0, 60);
    if (typeof req.body.name === 'string') {
      const name = req.body.name.trim();
      if (name.length < 2 || name.length > 40) {
        return res.status(400).json({ error: 'Name must be 2 to 40 characters' });
      }
      update.name = name;
    }
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
    res.json({ user: toPublic(user) });
  } catch (err) {
    next(err);
  }
});

export default router;