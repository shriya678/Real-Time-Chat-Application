import { formatMessageTime } from '../utils/formatTime.js';

export function MessageBubble({ message, isOwn }) {
  return (
    <div className={`msg ${isOwn ? 'msg--own' : 'msg--other'}`}>
      {!isOwn && <div className="msg-author">{message.username}</div>}
      <div className="msg-bubble">
        <div className="msg-content">{message.content}</div>
        <div className="msg-time">{formatMessageTime(message.createdAt)}</div>
      </div>
    </div>
  );
}
