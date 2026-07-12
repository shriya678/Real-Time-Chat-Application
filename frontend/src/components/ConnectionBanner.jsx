export function ConnectionBanner({ isConnected }) {
  if (isConnected) return null;
  return (
    <div className="conn-banner" role="status" aria-live="polite">
      <span className="conn-banner-dot" aria-hidden="true" />
      Connecting to server…
    </div>
  );
}
