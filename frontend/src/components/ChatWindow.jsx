import { MessageList } from './MessageList.jsx';
import { MessageInput } from './MessageInput.jsx';
import '../styles/chat.css';

export function ChatWindow({ messages, currentUsername, onSend, disabled = false }) {
  return (
    <div className="chat-window">
      <div className="chat-list-area">
        <MessageList messages={messages} currentUsername={currentUsername} />
      </div>
      <div className="chat-input-area">
        <MessageInput onSend={onSend} disabled={disabled} />
      </div>
    </div>
  );
}
