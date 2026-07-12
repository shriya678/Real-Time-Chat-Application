import { MessageList } from './MessageList.jsx';
import { MessageInput } from './MessageInput.jsx';
import { TypingIndicator } from './TypingIndicator.jsx';
import '../styles/chat.css';

export function ChatWindow({
  messages,
  currentUsername,
  onSend,
  disabled = false,
  typers = [],
  onType,
  onStopTyping,
}) {
  return (
    <div className="chat-window">
      <div className="chat-list-area">
        <MessageList messages={messages} currentUsername={currentUsername} />
      </div>
      <TypingIndicator typers={typers} />
      <div className="chat-input-area">
        <MessageInput
          onSend={onSend}
          onType={onType}
          onStopTyping={onStopTyping}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
