import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { getSocket } from '../socket/index.js';
import { fetchMessages } from '../api/messages.js';

const HISTORY_LIMIT = 50;

export const ChatContext = createContext(null);

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
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    // Socket may already be connected on mount (singleton persists across
    // ChatProvider mounts, e.g. logout → login without a page reload).
    if (socket.connected) setIsConnected(true);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('message:new', handleMessageNew);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('message:new', handleMessageNew);
    };
  }, []);

  const sendMessage = useCallback(
    (content) => {
      const socket = getSocket();
      socket.emit('message:send', { username, content });
    },
    [username],
  );

  const value = useMemo(
    () => ({
      messages,
      sendMessage,
      isConnected,
      isLoadingHistory,
      historyError,
    }),
    [messages, sendMessage, isConnected, isLoadingHistory, historyError],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
