import React, { useEffect } from 'react';

export function ConfirmModal({ isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false, onConfirm, onCancel }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" id="confirm-modal-overlay" onClick={onCancel}>
      <div className="modal-content" id="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 8, fontSize: 18 }}>{title}</h3>
        <p style={{ marginBottom: 20, fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          {message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            id="modal-cancel-btn"
            className="btn btn-secondary btn-sm"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            id="modal-confirm-btn"
            className={`btn btn-sm ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
