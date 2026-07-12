import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { getSocket } from '../socket/index.js';
import { fetchMessages } from '../api/messages.js';

const HISTORY_LIMIT = 50;

export const ChatContext = createContext(null);

function generateTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ChatProvider({ username, children }) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  // Initial history load via REST.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingHistory(true);
    setHistoryError(null);

    fetchMessages({ limit: HISTORY_LIMIT })
      .then((result) => {
        if (cancelled) return;
        const history = result?.messages ?? [];
        // Merge history with any live messages that arrived before it resolved.
        setMessages((prev) => {
          const historyIds = new Set(history.map((m) => m.id));
          const liveOnly = prev.filter((m) => !historyIds.has(m.id));
          return [...history, ...liveOnly];
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setHistoryError(err.message || 'Failed to load chat history');
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Socket lifecycle + live message subscriptions.
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handleMessageNew = (message) => {
      setMessages((prev) => {
        // Own message echoed back from the server with tempId — reconcile in place.
        if (message.tempId) {
          const idx = prev.findIndex((m) => m.tempId === message.tempId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = message;
            return next;
          }
        }
        // Standard dedupe by real id.
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    const handleReadUpdate = ({ messageId, username: reader, readAt } = {}) => {
      if (!messageId || !reader) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx === -1) return prev;
        const target = prev[idx];
        const existing = Array.isArray(target.readBy) ? target.readBy : [];
        // Dedupe — server's atomic filter should prevent this, defense in depth.
        if (existing.some((r) => r.username === reader)) return prev;

        const next = [...prev];
        next[idx] = {
          ...target,
          readBy: [...existing, { username: reader, readAt }],
        };
        return next;
      });
    };

    // Socket may already be connected on mount (singleton persists across
    // ChatProvider mounts, e.g. logout → login without a page reload).
    if (socket.connected) setIsConnected(true);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('message:new', handleMessageNew);
    socket.on('message:read-update', handleReadUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message:new', handleMessageNew);
      socket.off('message:read-update', handleReadUpdate);
    };
  }, []);

  const sendMessage = useCallback(
    (content) => {
      const socket = getSocket();
      const tempId = generateTempId();
      const optimistic = {
        id: tempId,
        tempId,
        username,
        content,
        createdAt: new Date().toISOString(),
        deliveredAt: null,
        readBy: [],
        status: 'pending',
      };

      setMessages((prev) => [...prev, optimistic]);

      socket.emit('message:send', { username, content, tempId }, (ack) => {
        if (!ack?.success) {
          // Server rejected the message — rollback the optimistic entry.
          // Success case is handled by handleMessageNew (server echoes back with tempId).
          setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
        }
      });
    },
    [username],
  );

  const markMessageRead = useCallback(
    (messageId) => {
      if (!messageId) return;
      const socket = getSocket();
      if (!socket.connected) return; // best-effort; re-fires on scroll after reconnect
      socket.emit('message:read', { messageId, username });
    },
    [username],
  );

  const value = useMemo(
    () => ({
      messages,
      sendMessage,
      markMessageRead,
      isConnected,
      isLoadingHistory,
      historyError,
    }),
    [
      messages,
      sendMessage,
      markMessageRead,
      isConnected,
      isLoadingHistory,
      historyError,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
