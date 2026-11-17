import { buildSeatLayout } from '../utils/seats.js';

// Live, in-memory state for rooms that currently have people in them.
// Messages and rooms themselves live in MongoDB; seats, presence and the
// timer are ephemeral and disappear when the last person leaves.
//
// NOTE: because this is in-process memory, run a single server instance.
// To scale out, move this to Redis and add the Socket.IO Redis adapter.

const IDLE_TIMER = { phase: 'idle', startedAt: null, durationMs: 0, endsAt: null };

const rooms = new Map();

export function ensureState(roomId, roomDoc) {
  let state = rooms.get(roomId);
  if (!state) {
    state = {
      roomId,
      ownerId: String(roomDoc.owner),
      settings: { focusMinutes: roomDoc.focusMinutes, breakMinutes: roomDoc.breakMinutes },
      seats: buildSeatLayout(roomDoc.maxSeats),
      occupants: new Map(), // userId -> { user, seatId, sockets:Set }
      banned: new Set(),
      timer: { ...IDLE_TIMER },
      timeout: null,
    };
    rooms.set(roomId, state);
  }
  return state;
}

export const getState = (roomId) => rooms.get(roomId);

// Which room (if any) is this user sitting in right now?
export function findRoomIdOfUser(userId) {
  for (const [roomId, state] of rooms) {
    if (state.occupants.has(userId)) return roomId;
  }
  return null;
}

export const getOccupantCount = (roomId) => rooms.get(roomId)?.occupants.size ?? 0;

export function addSocket(state, user, socketId) {
  let occupant = state.occupants.get(user.id);
  if (!occupant) {
    occupant = { user, seatId: null, sockets: new Set() };
    state.occupants.set(user.id, occupant);
  }
  occupant.sockets.add(socketId);
  return occupant;
}

// Returns true if the person is gone from the room entirely (not just one tab)
export function removeSocket(state, userId, socketId) {
  const occupant = state.occupants.get(userId);
  if (!occupant) return false;
  occupant.sockets.delete(socketId);
  if (occupant.sockets.size === 0) {
    state.occupants.delete(userId);
    return true;
  }
  return false;
}

export const isEmpty = (state) => state.occupants.size === 0;

export function listOccupants(state) {
  return [...state.occupants.values()].map((o) => ({
    userId: o.user.id,
    name: o.user.name,
    subject: o.user.subject,
    seatId: o.seatId,
  }));
}

export function startTimer(state, onChange, phase = 'focus') {
  clearTimeout(state.timeout);
  const minutes = phase === 'focus' ? state.settings.focusMinutes : state.settings.breakMinutes;
  const durationMs = minutes * 60_000;
  const startedAt = Date.now();
  state.timer = { phase, startedAt, durationMs, endsAt: startedAt + durationMs };
  // When a phase ends, flip to the other one automatically
  state.timeout = setTimeout(
    () => startTimer(state, onChange, phase === 'focus' ? 'break' : 'focus'),
    durationMs
  );
  onChange(state.timer);
}

export function resetTimer(state, onChange) {
  clearTimeout(state.timeout);
  state.timeout = null;
  state.timer = { ...IDLE_TIMER };
  onChange(state.timer);
}

export function disposeState(roomId) {
  const state = rooms.get(roomId);
  if (state) clearTimeout(state.timeout);
  rooms.delete(roomId);
}
