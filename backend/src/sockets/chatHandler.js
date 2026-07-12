import * as messageService from '../services/messageService.js';
import { validate } from '../middleware/validate.js';
import { MESSAGE_BODY_SCHEMA } from '../models/Message.js';
import { logger } from '../utils/logger.js';

export const CHAT_EVENTS = {
  SEND: 'message:send',
  NEW: 'message:new',
  ERROR: 'message:error',
  READ: 'message:read',
  READ_UPDATE: 'message:read-update',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
};

function respondError(socket, ack, code, message, details) {
  const payload = details ? { code, message, details } : { code, message };
  socket.emit(CHAT_EVENTS.ERROR, payload);
  if (typeof ack === 'function') ack({ success: false, error: payload });
}

export function registerChatHandlers(io, socket) {
  socket.on(CHAT_EVENTS.SEND, async (rawPayload, ack) => {
    const { valid, errors, sanitized } = validate(MESSAGE_BODY_SCHEMA, rawPayload);
    const tempId = rawPayload?.tempId;

    if (!valid) {
      respondError(socket, ack, 'VALIDATION_ERROR', 'Validation failed', errors);
      return;
    }

    try {
      const message = await messageService.createMessage(sanitized);

      // Broadcast to everyone else without tempId.
      socket.broadcast.emit(CHAT_EVENTS.NEW, message);
      // Echo back to sender WITH tempId so their client can reconcile the
      // optimistic entry into the real persisted message.
      socket.emit(
        CHAT_EVENTS.NEW,
        tempId ? { ...message, tempId } : message,
      );

      if (typeof ack === 'function') ack({ success: true, data: message, tempId });
    } catch (err) {
      logger.error('message:send failed', {
        message: err.message,
        socketId: socket.id,
      });
      respondError(socket, ack, 'INTERNAL_ERROR', 'Failed to persist message');
    }
  });

  socket.on(CHAT_EVENTS.READ, async (payload) => {
    const messageId = String(payload?.messageId || '').trim();
    const username = String(payload?.username || '').trim();
    if (!messageId || !username) return;

    try {
      const receipt = await messageService.markMessageRead({ messageId, username });
      // receipt is null when the user has already read this message — no broadcast.
      if (receipt) {
        io.emit(CHAT_EVENTS.READ_UPDATE, receipt);
      }
    } catch (err) {
      // Malformed messageId or bad payload — expected user-side race, not a server bug.
      logger.warn('message:read failed', {
        message: err.message,
        socketId: socket.id,
      });
    }
  });

  socket.on(CHAT_EVENTS.TYPING_START, (payload) => {
    const username = String(payload?.username || '').trim();
    if (!username) return;
    socket.data.typingAs = username;
    socket.broadcast.emit(CHAT_EVENTS.TYPING_START, { username });
  });

  socket.on(CHAT_EVENTS.TYPING_STOP, (payload) => {
    const username = String(payload?.username || '').trim();
    if (!username) return;
    delete socket.data.typingAs;
    socket.broadcast.emit(CHAT_EVENTS.TYPING_STOP, { username });
  });

  socket.on('disconnect', () => {
    if (socket.data.typingAs) {
      socket.broadcast.emit(CHAT_EVENTS.TYPING_STOP, {
        username: socket.data.typingAs,
      });
      delete socket.data.typingAs;
    }
  });
}
