import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export function useConfirmationDialog() {
  const [dialog, setDialog] = useState(null);

  const requestConfirmation = useCallback((options, onConfirm) => {
    setDialog({
      title: options.title,
      description: options.description,
      details: options.details || [],
      confirmLabel: options.confirmLabel || 'Confirm',
      tone: options.tone || 'warning',
      onConfirm,
    });
  }, []);

  const closeConfirmation = useCallback(() => {
    setDialog(null);
  }, []);

  const confirmationDialog = dialog ? (
    <ConfirmationDialog
      confirmLabel={dialog.confirmLabel}
      description={dialog.description}
      details={dialog.details}
      title={dialog.title}
      tone={dialog.tone}
      onCancel={closeConfirmation}
      onConfirm={() => {
        const confirmAction = dialog.onConfirm;
        closeConfirmation();
        confirmAction?.();
      }}
    />
  ) : null;

  return {
    confirmationDialog,
    requestConfirmation,
  };
}

function ConfirmationDialog({
  confirmLabel,
  description,
  details,
  onCancel,
  onConfirm,
  title,
  tone,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="erp-confirm-backdrop"
      data-testid="confirmation-backdrop"
      role="presentation"
      onMouseDown={onCancel}
    >
      <section
        aria-labelledby="erp-confirm-title"
        aria-modal="true"
        className={`erp-confirm-dialog ${tone === 'danger' ? 'danger' : ''}`}
        data-testid="confirmation-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="erp-confirm-icon" aria-hidden="true">
          <AlertTriangle size={20} />
        </div>
        <div className="erp-confirm-content">
          <h2 id="erp-confirm-title">{title}</h2>
          {description && <p>{description}</p>}
          {details.length > 0 && (
            <dl className="erp-confirm-details">
              {details.map((detail) => (
                <div key={detail.label}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="erp-confirm-actions">
          <button
            className="erp-button secondary"
            data-testid="confirmation-cancel"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={tone === 'danger' ? 'erp-button secondary danger' : 'erp-button'}
            data-testid="confirmation-confirm"
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
