import { useEffect, useState } from 'react';
import { getSocket } from '../socket/index.js';

export function usePresence({ username }) {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const socket = getSocket();
    const name = username?.trim();
    if (!name) return;

    const announce = () => {
      socket.emit('presence:join', { username: name });
    };

    const handleList = ({ users } = {}) => {
      if (Array.isArray(users)) setOnlineUsers(users);
    };

    const handleJoin = ({ username: joiner } = {}) => {
      if (!joiner) return;
      setOnlineUsers((prev) => (prev.includes(joiner) ? prev : [...prev, joiner]));
    };

    const handleLeave = ({ username: leaver } = {}) => {
      if (!leaver) return;
      setOnlineUsers((prev) => prev.filter((u) => u !== leaver));
    };

    const handleDisconnect = () => {
      setOnlineUsers([]);
    };

    // Announce immediately if already connected; otherwise on the next connect.
    // Fires again on Socket.io's automatic reconnect.
    if (socket.connected) announce();
    socket.on('connect', announce);
    socket.on('presence:list', handleList);
    socket.on('presence:join', handleJoin);
    socket.on('presence:leave', handleLeave);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', announce);
      socket.off('presence:list', handleList);
      socket.off('presence:join', handleJoin);
      socket.off('presence:leave', handleLeave);
      socket.off('disconnect', handleDisconnect);
    };
  }, [username]);

  return { onlineUsers };
}
