import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config.js';
import User from '../models/User.js';
import Room from '../models/Room.js';
import Message from '../models/Message.js';
import {
  ensureState,
  getState,
  addSocket,
  removeSocket,
  isEmpty,
  listOccupants,
  startTimer,
  resetTimer,
  disposeState,
} from './roomState.js';

const MAX_MESSAGE_LENGTH = 500;
const RATE_WINDOW_MS = 5000;
const RATE_MAX_MESSAGES = 5;

const serializeMessage = (m) => ({
  id: String(m._id),
  userId: String(m.user),
  userName: m.userName,
  text: m.text,
  createdAt: m.createdAt,
});

function allowMessage(socket) {
  const now = Date.now();
  const rl = socket.data.rateLimit;
  if (now > rl.resetAt) {
    rl.count = 0;
    rl.resetAt = now + RATE_WINDOW_MS;
  }
  rl.count += 1;
  return rl.count <= RATE_MAX_MESSAGES;
}

function leaveRoom(io, socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  socket.leave(roomId);
  socket.data.roomId = null;

  const state = getState(roomId);
  if (!state) return;

  const gone = removeSocket(state, socket.data.user.id, socket.id);
  if (isEmpty(state)) {
    disposeState(roomId);
  } else if (gone) {
    io.to(roomId).emit('presence:update', listOccupants(state));
  }
}

export function registerSocket(io) {
  // Authenticate every connection with the same JWT used for the REST API
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(payload.sub).lean();
      if (!user) return next(new Error('User not found'));
      socket.data.user = { id: String(user._id), name: user.name, subject: user.subject };
      socket.data.rateLimit = { count: 0, resetAt: 0 };
      next();
    } catch {
      next(new Error('Invalid or expired session'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    // Helper: current room state, or null if the socket has not joined one
    const current = () => (socket.data.roomId ? getState(socket.data.roomId) : null);
    const broadcastPresence = (state) =>
      io.to(state.roomId).emit('presence:update', listOccupants(state));
    const broadcastTimer = (state) => (timer) =>
      io.to(state.roomId).emit('timer:update', { timer, serverNow: Date.now() });

    socket.on('room:join', async (payload, ack = () => {}) => {
      try {
        const roomId = payload?.roomId;
        if (!mongoose.isValidObjectId(roomId)) return ack({ ok: false, error: 'Invalid room' });

        const room = await Room.findById(roomId).lean();
        if (!room) return ack({ ok: false, error: 'Room not found' });

        const isMember = room.members.some((m) => String(m) === user.id);
        if (room.isPrivate && !isMember) return ack({ ok: false, error: 'This room is private' });

        const existing = getState(roomId);
        if (existing?.banned.has(user.id)) {
          return ack({ ok: false, error: 'You were removed from this room' });
        }

        if (socket.data.roomId && socket.data.roomId !== roomId) leaveRoom(io, socket);

        const state = ensureState(roomId, room);
        addSocket(state, user, socket.id);
        socket.data.roomId = roomId;
        socket.join(roomId);

        const recent = await Message.find({ room: roomId }).sort({ createdAt: -1 }).limit(50).lean();

        ack({
          ok: true,
          room: {
            id: roomId,
            name: room.name,
            subject: room.subject,
            ownerId: String(room.owner),
            isPrivate: room.isPrivate,
            focusMinutes: room.focusMinutes,
            breakMinutes: room.breakMinutes,
          },
          seats: state.seats,
          occupants: listOccupants(state),
          timer: state.timer,
          serverNow: Date.now(),
          messages: recent.reverse().map(serializeMessage),
        });
        broadcastPresence(state);
      } catch (err) {
        console.error('room:join failed', err);
        ack({ ok: false, error: 'Could not join the room' });
      }
    });

    socket.on('room:leave', () => leaveRoom(io, socket));

    socket.on('chat:send', async (payload, ack = () => {}) => {
      try {
        const state = current();
        if (!state) return ack({ ok: false, error: 'Join a room first' });

        const text = String(payload?.text ?? '').trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!text) return ack({ ok: false, error: 'Message is empty' });
        if (!allowMessage(socket)) return ack({ ok: false, error: 'You are sending messages too fast' });

        const doc = await Message.create({
          room: state.roomId,
          user: user.id,
          userName: user.name,
          text,
        });
        io.to(state.roomId).emit('chat:message', serializeMessage(doc));
        ack({ ok: true });
      } catch (err) {
        console.error('chat:send failed', err);
        ack({ ok: false, error: 'Message could not be sent' });
      }
    });

    // The server decides who gets a seat, so two people can never share one.
    // Handlers run synchronously, which makes this check-then-set race-free.
    socket.on('seat:sit', (payload, ack = () => {}) => {
      const state = current();
      if (!state) return ack({ ok: false, error: 'Join a room first' });

      const seat = state.seats.find((s) => s.id === payload?.seatId);
      if (!seat) return ack({ ok: false, error: 'That seat does not exist' });

      const taken = [...state.occupants.values()].some(
        (o) => o.seatId === seat.id && o.user.id !== user.id
      );
      if (taken) return ack({ ok: false, error: 'Someone is already sitting there' });

      state.occupants.get(user.id).seatId = seat.id;
      broadcastPresence(state);
      ack({ ok: true });
    });

    socket.on('seat:stand', (_payload, ack = () => {}) => {
      const state = current();
      if (!state) return ack({ ok: false, error: 'Join a room first' });
      state.occupants.get(user.id).seatId = null;
      broadcastPresence(state);
      ack({ ok: true });
    });

    // Only the room owner controls the shared timer
    socket.on('timer:start', (_payload, ack = () => {}) => {
      const state = current();
      if (!state) return ack({ ok: false, error: 'Join a room first' });
      if (state.ownerId !== user.id) return ack({ ok: false, error: 'Only the room owner can do that' });
      startTimer(state, broadcastTimer(state), 'focus');
      ack({ ok: true });
    });

    socket.on('timer:reset', (_payload, ack = () => {}) => {
      const state = current();
      if (!state) return ack({ ok: false, error: 'Join a room first' });
      if (state.ownerId !== user.id) return ack({ ok: false, error: 'Only the room owner can do that' });
      resetTimer(state, broadcastTimer(state));
      ack({ ok: true });
    });

    // Moderation: the owner can remove someone for the rest of the session
    socket.on('mod:kick', (payload, ack = () => {}) => {
      const state = current();
      if (!state) return ack({ ok: false, error: 'Join a room first' });
      if (state.ownerId !== user.id) return ack({ ok: false, error: 'Only the room owner can do that' });

      const targetId = String(payload?.userId ?? '');
      const target = state.occupants.get(targetId);
      if (!target || targetId === user.id) return ack({ ok: false, error: 'Cannot remove that person' });

      state.banned.add(targetId);
      for (const socketId of target.sockets) {
        const s = io.sockets.sockets.get(socketId);
        if (s) {
          s.emit('room:kicked');
          s.leave(state.roomId);
          s.data.roomId = null;
        }
      }
      state.occupants.delete(targetId);
      broadcastPresence(state);
      ack({ ok: true });
    });

    socket.on('disconnect', () => leaveRoom(io, socket));
  });
}
