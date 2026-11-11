import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signToken = (user) => jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '7d' });

const toPublic = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  subject: user.subject,
});

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
    const user = await User.create({ name, email, passwordHash, subject });
    res.status(201).json({ token: signToken(user), user: toPublic(user) });
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

    res.json({ token: signToken(user), user: toPublic(user) });
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
