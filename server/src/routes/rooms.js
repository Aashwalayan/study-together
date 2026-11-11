import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Room from '../models/Room.js';
import { requireAuth } from '../middleware/auth.js';
import { getOccupantCount } from '../socket/roomState.js';

const router = Router();
router.use(requireAuth);

const canAccess = (room, userId) =>
  !room.isPrivate || room.members.some((m) => String(m) === userId);

const serialize = (room, userId) => {
  const isOwner = String(room.owner) === userId;
  return {
    id: String(room._id),
    name: room.name,
    subject: room.subject,
    isPrivate: room.isPrivate,
    isOwner,
    // Only the owner sees the code; members who joined with it already have it
    inviteCode: isOwner ? room.inviteCode : undefined,
    maxSeats: room.maxSeats,
    focusMinutes: room.focusMinutes,
    breakMinutes: room.breakMinutes,
    occupants: getOccupantCount(String(room._id)),
  };
};

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Public rooms, plus private rooms the user belongs to
router.get('/', async (req, res, next) => {
  try {
    const rooms = await Room.find({ $or: [{ isPrivate: false }, { members: req.user.id }] })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ rooms: rooms.map((r) => serialize(r, req.user.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ error: 'Room name must be 2 to 60 characters' });
    }

    const isPrivate = Boolean(req.body.isPrivate);
    const room = await Room.create({
      name,
      subject: String(req.body.subject || '').trim().slice(0, 60),
      owner: req.user.id,
      isPrivate,
      inviteCode: isPrivate ? crypto.randomBytes(3).toString('hex').toUpperCase() : undefined,
      members: [req.user.id],
      focusMinutes: clampInt(req.body.focusMinutes, 1, 120, 25),
      breakMinutes: clampInt(req.body.breakMinutes, 1, 60, 5),
    });

    res.status(201).json({ room: serialize(room, req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/join', async (req, res, next) => {
  try {
    const code = String(req.body.inviteCode || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Enter an invite code' });

    const room = await Room.findOneAndUpdate(
      { inviteCode: code },
      { $addToSet: { members: req.user.id } },
      { new: true }
    );
    if (!room) return res.status(404).json({ error: 'No room matches that code' });

    res.json({ room: serialize(room, req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Room not found' });
    const room = await Room.findById(req.params.id).lean();
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!canAccess(room, req.user.id)) return res.status(403).json({ error: 'This room is private' });
    res.json({ room: serialize(room, req.user.id) });
  } catch (err) {
    next(err);
  }
});

export default router;
