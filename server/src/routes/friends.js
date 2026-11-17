import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Room from '../models/Room.js';
import Friendship, { pairKeyOf } from '../models/Friendship.js';
import { requireAuth } from '../middleware/auth.js';
import { findRoomIdOfUser } from '../socket/roomState.js';

const router = Router();
router.use(requireAuth);

const MAX_PENDING_SENT = 50;

const toCard = (u) => ({
  userId: String(u._id),
  name: u.name,
  username: u.username || null,
  subject: u.subject || '',
  bio: u.bio || '',
});

// Friends, incoming requests, outgoing requests, and where each friend is right now
router.get('/', async (req, res, next) => {
  try {
    const me = req.user.id;
    const rows = await Friendship.find({ $or: [{ requester: me }, { recipient: me }] })
      .sort({ updatedAt: -1 })
      .lean();
    const otherId = (r) => (String(r.requester) === me ? String(r.recipient) : String(r.requester));

    const users = await User.find({ _id: { $in: rows.map(otherId) } })
      .select('name username subject bio')
      .lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    // Which room is each friend sitting in right now?
    const roomIdByFriend = new Map();
    for (const r of rows) {
      if (r.status !== 'accepted') continue;
      const roomId = findRoomIdOfUser(otherId(r));
      if (roomId) roomIdByFriend.set(otherId(r), roomId);
    }
    const rooms = await Room.find({ _id: { $in: [...new Set(roomIdByFriend.values())] } })
      .select('name isPrivate members')
      .lean();
    const roomById = new Map(rooms.map((r) => [String(r._id), r]));

    const friends = [];
    const incoming = [];
    const outgoing = [];
    for (const r of rows) {
      const user = byId.get(otherId(r));
      if (!user) continue;
      const card = toCard(user);

      if (r.status === 'accepted') {
        let presence = null;
        const room = roomById.get(roomIdByFriend.get(card.userId));
        if (room) {
          // Never reveal the name of a private room the viewer isn't part of
          const canSee = !room.isPrivate || room.members.some((m) => String(m) === me);
          presence = canSee ? { roomId: String(room._id), roomName: room.name } : { private: true };
        }
        friends.push({ ...card, friendshipId: String(r._id), presence });
      } else if (String(r.recipient) === me) {
        incoming.push({ ...card, id: String(r._id) });
      } else {
        outgoing.push({ ...card, id: String(r._id) });
      }
    }

    // Friends who are in a room come first
    friends.sort(
      (a, b) => Number(Boolean(b.presence)) - Number(Boolean(a.presence)) || a.name.localeCompare(b.name)
    );
    res.json({ friends, incoming, outgoing });
  } catch (err) {
    next(err);
  }
});

// Find people by username (prefix match, verified accounts only)
router.get('/search', async (req, res, next) => {
  try {
    const me = req.user.id;
    const q = String(req.query.q || '').trim().toLowerCase().replace(/^@/, '');
    // The character check also makes it safe to use q inside a regex
    if (q.length < 2 || !/^[a-z0-9_]+$/.test(q)) return res.json({ users: [] });

    const users = await User.find({ username: { $regex: `^${q}` }, emailVerified: true, _id: { $ne: me } })
      .select('name username subject')
      .limit(8)
      .lean();

    const ids = users.map((u) => u._id);
    const rows = await Friendship.find({
      $or: [
        { requester: me, recipient: { $in: ids } },
        { recipient: me, requester: { $in: ids } },
      ],
    }).lean();
    const byOther = new Map(
      rows.map((r) => [String(r.requester) === me ? String(r.recipient) : String(r.requester), r])
    );

    res.json({
      users: users.map((u) => {
        const row = byOther.get(String(u._id));
        let relation = 'none';
        if (row) relation = row.status === 'accepted' ? 'friends' : String(row.requester) === me ? 'sent' : 'received';
        return { ...toCard(u), relation, requestId: relation === 'received' ? String(row._id) : undefined };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// Send a friend request. If they already asked you, this accepts theirs instead.
router.post('/requests', async (req, res, next) => {
  try {
    const me = req.user.id;
    const targetId = String(req.body.userId || '');
    if (!mongoose.isValidObjectId(targetId)) return res.status(400).json({ error: 'Invalid user' });
    if (targetId === me) return res.status(400).json({ error: 'You can’t add yourself' });

    const target = await User.findOne({ _id: targetId, emailVerified: true }).lean();
    if (!target) return res.status(404).json({ error: 'User not found' });

    const existing = await Friendship.findOne({ pairKey: pairKeyOf(me, targetId) });
    if (existing) {
      if (existing.status === 'accepted') return res.status(409).json({ error: 'You are already friends' });
      if (String(existing.requester) === me) return res.status(409).json({ error: 'Request already sent' });
      existing.status = 'accepted';
      await existing.save();
      return res.json({ status: 'friends' });
    }

    if ((await Friendship.countDocuments({ requester: me, status: 'pending' })) >= MAX_PENDING_SENT) {
      return res.status(429).json({ error: 'You have too many pending requests. Wait for some to be answered.' });
    }

    try {
      await Friendship.create({ requester: me, recipient: targetId, pairKey: pairKeyOf(me, targetId) });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'Request already sent' });
      throw err;
    }
    res.status(201).json({ status: 'sent' });
  } catch (err) {
    next(err);
  }
});

router.post('/requests/:id/accept', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Request not found' });
    const row = await Friendship.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id, status: 'pending' },
      { status: 'accepted' },
      { new: true }
    );
    if (!row) return res.status(404).json({ error: 'Request not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Decline an incoming request or cancel one you sent
router.delete('/requests/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Request not found' });
    const me = req.user.id;
    const result = await Friendship.deleteOne({
      _id: req.params.id,
      status: 'pending',
      $or: [{ requester: me }, { recipient: me }],
    });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Request not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Remove a friend
router.delete('/:userId', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ error: 'Friend not found' });
    const result = await Friendship.deleteOne({
      pairKey: pairKeyOf(req.user.id, req.params.userId),
      status: 'accepted',
    });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Friend not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;