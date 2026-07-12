import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/**
 * Lazy singleton — returns the same socket instance forever.
 * Auto-connects and auto-reconnects. If the socket was explicitly disconnected
 * (e.g. via disconnectSocket on logout), a subsequent getSocket() call
 * reconnects it rather than returning a dead reference.
 */
export function getSocket() {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

/**
 * Explicitly disconnect the socket. Used on logout so the server sees a
 * proper 'disconnect' event and can broadcast presence:leave + typing:stop
 * on the departing user's behalf. Safe no-op if the socket doesn't exist
 * or is already disconnected.
 */
export function disconnectSocket() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
}
