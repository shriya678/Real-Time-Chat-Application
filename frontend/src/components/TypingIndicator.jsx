function formatTypersText(typers) {
  if (typers.length === 1) return `${typers[0]} is typing…`;
  if (typers.length === 2) return `${typers[0]} and ${typers[1]} are typing…`;
  if (typers.length === 3)
    return `${typers[0]}, ${typers[1]}, and ${typers[2]} are typing…`;
  return `${typers[0]}, ${typers[1]}, and ${typers.length - 2} more are typing…`;
}

export function TypingIndicator({ typers }) {
  if (typers.length === 0) return null;

  return (
    <div className="typing-indicator" role="status" aria-live="polite">
      <span className="typing-dots" aria-hidden="true">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
      <span className="typing-text">{formatTypersText(typers)}</span>
    </div>
  );
}
