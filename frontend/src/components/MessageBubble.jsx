import { formatMessageTime } from '../utils/formatTime.js';
import { ReceiptIcon } from '../utils/receiptIcons.jsx';
import { useReadReceipts } from '../hooks/useReadReceipts.js';

function computeReceiptState(message, currentUsername) {
  if (message.status === 'pending') return 'pending';
  const otherReaders = (message.readBy || []).filter(
    (r) => r.username !== currentUsername,
  );
  if (otherReaders.length > 0) return 'read';
  return 'delivered';
}

export function MessageBubble({ message, isOwn, currentUsername, onMarkRead }) {
  const alreadyReadBySelf =
    Array.isArray(message.readBy) &&
    message.readBy.some((r) => r.username === currentUsername);
  const shouldObserve = !isOwn && !alreadyReadBySelf;

  const observeRef = useReadReceipts({
    shouldObserve,
    onEnterViewport: () => onMarkRead?.(message.id),
  });

  const receiptState = isOwn ? computeReceiptState(message, currentUsername) : null;

  return (
    <div ref={observeRef} className={`msg ${isOwn ? 'msg--own' : 'msg--other'}`}>
      {!isOwn && <div className="msg-author">{message.username}</div>}
      <div className="msg-bubble">
        <div className="msg-content">{message.content}</div>
        <div className="msg-meta">
          <span className="msg-time">{formatMessageTime(message.createdAt)}</span>
          {receiptState && <ReceiptIcon state={receiptState} />}
        </div>
      </div>
    </div>
  );
}
