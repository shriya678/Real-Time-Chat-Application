/**
 * Receipt tick icons — mirrors the state machine documented in APPROACH.md §13:
 *   pending   →  ✓        (gray single check)
 *   delivered →  ✓✓       (gray double check)
 *   read      →  ✓✓ blue  (at least one other user in readBy)
 * Colors come from the CSS classes; the SVG uses currentColor.
 */
export function ReceiptIcon({ state }) {
  if (state === 'pending') {
    return (
      <svg
        className="receipt-icon receipt-icon--pending"
        viewBox="0 0 16 16"
        aria-label="Sent"
      >
        <path
          d="M2.5 8.5 L6 12 L13.5 4"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const isRead = state === 'read';
  const className = `receipt-icon ${isRead ? 'receipt-icon--read' : 'receipt-icon--delivered'}`;
  const label = isRead ? 'Read' : 'Delivered';

  return (
    <svg className={className} viewBox="0 0 20 16" aria-label={label}>
      <path
        d="M1 8 L4.5 11.5 L11 5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 8 L10.5 11.5 L17 5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
