import { logger } from '../utils/logger.js';

export const PRESENCE_EVENTS = {
  JOIN: 'presence:join',
  LEAVE: 'presence:leave',
  LIST: 'presence:list',
};

// Module-level state: socketId → username. One entry per active socket.
// A user with N tabs has N entries; presence:join/leave broadcasts are gated
// on the count transitioning between 0 and 1 for that username.
const socketToUser = new Map();

function getOnlineUsernames() {
  return Array.from(new Set(socketToUser.values()));
}

function countSocketsFor(username) {
  let count = 0;
  for (const u of socketToUser.values()) {
    if (u === username) count += 1;
  }
  return count;
}

export function registerPresenceHandlers(io, socket) {
  socket.on(PRESENCE_EVENTS.JOIN, (payload) => {
    const username = String(payload?.username || '').trim();
    if (!username) return;

    const isFirstSocketForUser = countSocketsFor(username) === 0;
    socketToUser.set(socket.id, username);
    socket.data.presenceUsername = username;

    // Send the current roster to the joiner only.
    socket.emit(PRESENCE_EVENTS.LIST, { users: getOnlineUsernames() });

    // Broadcast join to others only when the user's first socket connects.
    if (isFirstSocketForUser) {
      socket.broadcast.emit(PRESENCE_EVENTS.JOIN, { username });
      logger.info('presence: user online', { username });
    }
  });

  socket.on('disconnect', () => {
    const username = socket.data.presenceUsername;
    if (!username) return;

    socketToUser.delete(socket.id);
    delete socket.data.presenceUsername;

    // Broadcast leave only when the user's last socket closes.
    if (countSocketsFor(username) === 0) {
      socket.broadcast.emit(PRESENCE_EVENTS.LEAVE, { username });
      logger.info('presence: user offline', { username });
    }
  });
}
