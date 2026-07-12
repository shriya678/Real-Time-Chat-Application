import { Message } from '../models/Message.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function clampLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseCursor(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    const err = new Error('Invalid "before" cursor — must be a valid ISO date');
    err.status = 400;
    err.code = 'INVALID_CURSOR';
    throw err;
  }
  return date;
}

export async function createMessage({ username, content }) {
  const message = await Message.create({ username, content });
  return message.toJSON();
}

/**
 * Mark a message as read by `username`. Atomic — the `$ne` filter prevents
 * duplicate receipts if the same user's IntersectionObserver fires twice.
 * Returns the receipt payload on success, or `null` if the user has already
 * read this message (no-op — no broadcast should follow).
 */
export async function markMessageRead({ messageId, username }) {
  const trimmed = String(username || '').trim();
  if (!trimmed || !messageId) return null;

  const readAt = new Date();
  const result = await Message.updateOne(
    {
      _id: messageId,
      'readBy.username': { $ne: trimmed },
    },
    {
      $push: { readBy: { username: trimmed, readAt } },
    },
  );

  if (result.modifiedCount === 0) return null;
  return { messageId, username: trimmed, readAt };
}

export async function listMessages({ limit, before } = {}) {
  const effectiveLimit = clampLimit(limit);
  const beforeDate = parseCursor(before);

  const query = beforeDate ? { createdAt: { $lt: beforeDate } } : {};

  const docs = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(effectiveLimit + 1);

  const hasMore = docs.length > effectiveLimit;
  const trimmed = hasMore ? docs.slice(0, effectiveLimit) : docs;
  const messages = trimmed.map((m) => m.toJSON()).reverse();

  const nextCursor = hasMore ? messages[0].createdAt.toISOString() : null;

  return { messages, hasMore, nextCursor };
}
