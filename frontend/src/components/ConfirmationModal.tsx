
export interface ConfirmationModalProps {
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  title,
  content,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        {/* Header (heading + close button) */}
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={onCancel}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          <p>{content}</p>
        </div>

        {/* Actions (if any exist show them here, otherwise empty) */}
        {(confirmText || cancelText) && (
          <div className="modal-actions">
            {cancelText && (
              <button className="btn btn-secondary" onClick={onCancel}>
                {cancelText}
              </button>
            )}
            {confirmText && (
              <button className="btn btn-danger" onClick={onConfirm}>
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
