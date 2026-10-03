/** Inline status banner used for errors and confirmations across pages. */
export default function Banner({ type = 'info', message, onClose }) {
  if (!message) return null;
  const icon = { error: '⚠', success: '✓', warning: '!', info: 'i' }[type] || 'i';
  return (
    <div className={`banner banner-${type}`}>
      <span aria-hidden="true">{icon}</span>
      <span>{message}</span>
      {onClose && (
        <button type="button" className="banner-close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
