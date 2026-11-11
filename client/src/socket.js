import { io } from 'socket.io-client';

// An empty/undefined URL makes socket.io connect to the page's own origin,
// which the Vite dev proxy forwards to the server.
export function createSocket(token) {
  return io(import.meta.env.VITE_SOCKET_URL || undefined, { auth: { token } });
}
