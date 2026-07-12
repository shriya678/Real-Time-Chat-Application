import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble.jsx';

export function MessageList({ messages, currentUsername, onMarkRead }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="chat-empty">
        <p>No messages yet.</p>
        <p className="chat-empty-hint">Say hi to break the ice.</p>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => (
        <MessageBubble
          key={message.id || message.tempId}
          message={message}
          isOwn={message.username === currentUsername}
          currentUsername={currentUsername}
          onMarkRead={onMarkRead}
        />
      ))}
      <div ref={bottomRef} />
    </>
  );
}
