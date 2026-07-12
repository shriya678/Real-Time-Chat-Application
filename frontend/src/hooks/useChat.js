import { useContext } from 'react';
import { ChatContext } from '../context/ChatContext.jsx';

export function useChat() {
  const ctx = useContext(ChatContext);
  if (ctx === null) {
    throw new Error('useChat must be used within a <ChatProvider>');
  }
  return ctx;
}
