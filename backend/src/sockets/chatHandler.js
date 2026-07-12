import * as messageService from '../services/messageService.js';
import { validate } from '../middleware/validate.js';
import { MESSAGE_BODY_SCHEMA } from '../models/Message.js';
import { logger } from '../utils/logger.js';

export const CHAT_EVENTS = {
  SEND: 'message:send',
  NEW: 'message:new',
  ERROR: 'message:error',
};

function respondError(socket, ack, code, message, details) {
  const payload = details ? { code, message, details } : { code, message };
  socket.emit(CHAT_EVENTS.ERROR, payload);
  if (typeof ack === 'function') ack({ success: false, error: payload });
}

export function registerChatHandlers(io, socket) {
  socket.on(CHAT_EVENTS.SEND, async (rawPayload, ack) => {
    const { valid, errors, sanitized } = validate(MESSAGE_BODY_SCHEMA, rawPayload);

    if (!valid) {
      respondError(socket, ack, 'VALIDATION_ERROR', 'Validation failed', errors);
      return;
    }

    try {
      const message = await messageService.createMessage(sanitized);
      io.emit(CHAT_EVENTS.NEW, message);
      if (typeof ack === 'function') ack({ success: true, data: message });
    } catch (err) {
      logger.error('message:send failed', {
        message: err.message,
        socketId: socket.id,
      });
      respondError(socket, ack, 'INTERNAL_ERROR', 'Failed to persist message');
    }
  });
}
