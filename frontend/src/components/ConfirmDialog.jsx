import { useEffect, useRef } from 'react';

/**
 * Minimal confirmation dialog. Destructive actions never use poetic copy
 * (PRODUCT_SPEC §3) and are never triggered by a single accidental tap.
 */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  busy = false,
}) {
  const cancelRef = useRef(null);

  // While the action is in flight the dialog cannot be dismissed —
  // a late completion must never land on a different dialog.
  const cancel = () => {
    if (!busy) onCancel();
  };

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  return (
    <div className="dialog-backdrop" onClick={cancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog-title">{title}</h2>
        {body && <p className="dialog-body">{body}</p>}
        <div className="dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn"
            onClick={cancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
