import type { ReactElement, ReactNode } from 'react';
import './Modal.css';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
};

/**
 * Modal overlay with backdrop, close button, and simple click-outside handling.
 * Note: focus trap/escape key can be added later if needed.
 */
export function Modal({
  open,
  onClose,
  children,
  maxWidth = '720px',
}: ModalProps): ReactElement | null {
  if (!open) return null;
  return (
    <div className="ds-modal__backdrop" onClick={onClose}>
      <div className="ds-modal" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ds-modal__close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="ds-modal__body">{children}</div>
      </div>
    </div>
  );
}
