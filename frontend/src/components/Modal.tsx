import { useEffect, useRef, type ReactNode } from 'react';
import './Modal.css';

type ModalProps = {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: string;
  dismissOnOverlayClick?: boolean;
};

export function Modal({
  title,
  children,
  footer,
  onClose,
  width,
  dismissOnOverlayClick = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (dismissOnOverlayClick && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        tabIndex={-1}
        style={width ? { maxWidth: width } : undefined}
      >
        <div className="ui-modal__header">
          {title ? <h2 className="ui-modal__title">{title}</h2> : <span />}
          <button className="ui-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="ui-modal__body">{children}</div>
        {footer ? <div className="ui-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
