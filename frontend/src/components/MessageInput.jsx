import { useState } from 'react';

const MAX_CONTENT_LENGTH = 1000;

export function MessageInput({ onSend, disabled = false }) {
  const [content, setContent] = useState('');

  const trimmed = content.trim();
  const canSend = trimmed.length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setContent('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="chat-input">
      <textarea
        rows={1}
        maxLength={MAX_CONTENT_LENGTH}
        placeholder="Message the lobby (Shift+Enter for newline)…"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="chat-input-textarea"
        aria-label="Message input"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        className="chat-input-send"
      >
        Send
      </button>
    </div>
  );
}
