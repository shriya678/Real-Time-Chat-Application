import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { registerChatHandlers } from './chatHandler.js';

export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.info('socket connected', { id: socket.id });

    registerChatHandlers(io, socket);
    //   presence handler → F9

    socket.on('disconnect', (reason) => {
      logger.info('socket disconnected', { id: socket.id, reason });
    });
  });

  return io;
}
