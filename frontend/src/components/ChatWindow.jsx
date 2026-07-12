import '../styles/chat.css';

export function ChatWindow() {
  return (
    <div className="chat-window">
      <div className="chat-list-area">
        <div className="chat-empty">
          <p>No messages yet.</p>
          <p className="chat-empty-hint">Say hi to break the ice.</p>
        </div>
      </div>
      <div className="chat-input-area">
        <div className="chat-input-placeholder">Message input arrives in F6.3.</div>
      </div>
    </div>
  );
}
