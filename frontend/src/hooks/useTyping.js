import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket/index.js';

const TYPING_START_THROTTLE_MS = 2000; // re-emit at most every 2s while typing
const TYPING_STOP_DELAY_MS = 2000; // emit stop after 2s of idle
const STALE_TYPER_TIMEOUT_MS = 5000; // client-side safety net

export function useTyping({ username }) {
  const [typers, setTypers] = useState([]);
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef(null);
  const lastStartEmitRef = useRef(0);
  const staleTimersRef = useRef(new Map()); // username → timeoutId

  useEffect(() => {
    const socket = getSocket();

    const clearStaleTimer = (user) => {
      const t = staleTimersRef.current.get(user);
      if (t) {
        clearTimeout(t);
        staleTimersRef.current.delete(user);
      }
    };

    const scheduleStaleRemoval = (user) => {
      clearStaleTimer(user);
      const t = setTimeout(() => {
        setTypers((prev) => prev.filter((u) => u !== user));
        staleTimersRef.current.delete(user);
      }, STALE_TYPER_TIMEOUT_MS);
      staleTimersRef.current.set(user, t);
    };

    const handleStart = ({ username: typer } = {}) => {
      if (!typer || typer === username) return;
      setTypers((prev) => (prev.includes(typer) ? prev : [...prev, typer]));
      scheduleStaleRemoval(typer);
    };

    const handleStop = ({ username: typer } = {}) => {
      if (!typer) return;
      clearStaleTimer(typer);
      setTypers((prev) => prev.filter((u) => u !== typer));
    };

    const handleDisconnect = () => {
      // Reset own typing state so the next session emits typing:start cleanly.
      isTypingRef.current = false;
      lastStartEmitRef.current = 0;
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      // Clear all incoming typers — they'll re-emit if still typing on reconnect.
      setTypers([]);
      staleTimersRef.current.forEach((t) => clearTimeout(t));
      staleTimersRef.current.clear();
    };

    socket.on('typing:start', handleStart);
    socket.on('typing:stop', handleStop);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('typing:start', handleStart);
      socket.off('typing:stop', handleStop);
      socket.off('disconnect', handleDisconnect);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      staleTimersRef.current.forEach((t) => clearTimeout(t));
      staleTimersRef.current.clear();
    };
  }, [username]);

  const handleTyping = useCallback(() => {
    const socket = getSocket();
    const now = Date.now();

    if (now - lastStartEmitRef.current >= TYPING_START_THROTTLE_MS) {
      socket.emit('typing:start', { username });
      lastStartEmitRef.current = now;
    }
    isTypingRef.current = true;

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      stopTimerRef.current = null;
      lastStartEmitRef.current = 0;
      socket.emit('typing:stop', { username });
    }, TYPING_STOP_DELAY_MS);
  }, [username]);

  const handleStopTyping = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      lastStartEmitRef.current = 0;
      getSocket().emit('typing:stop', { username });
    }
  }, [username]);

  return { typers, handleTyping, handleStopTyping };
}
