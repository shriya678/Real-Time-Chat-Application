import { useState } from 'react';

const MAX_CONTENT_LENGTH = 1000;

export function MessageInput({ onSend, onType, onStopTyping, disabled = false }) {
  const [content, setContent] = useState('');

  const trimmed = content.trim();
  const canSend = trimmed.length > 0 && !disabled;

  const handleChange = (event) => {
    setContent(event.target.value);
    if (!disabled && onType) onType();
  };

  const handleBlur = () => {
    if (onStopTyping) onStopTyping();
  };

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    setContent('');
    if (onStopTyping) onStopTyping();
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
        onChange={handleChange}
        onBlur={handleBlur}
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
