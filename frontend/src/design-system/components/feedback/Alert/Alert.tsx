import type { ReactElement } from 'react';
import './Alert.css';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

type AlertProps = {
  variant?: AlertVariant;
  title?: string;
  message: string;
  className?: string;
};

export function Alert({ variant = 'info', title, message, className }: AlertProps): ReactElement {
  const rootClass = ['ds-alert', `ds-alert--${variant}`, className].filter(Boolean).join(' ');
  const iconMap: Record<AlertVariant, string> = {
    success: '\ue86c',
    info: '\ue88e',
    warning: '\ue002',
    error: '\ue000',
  };
  return (
    <div className={rootClass} role="status">
      <span className="ds-alert__icon" aria-hidden="true">
        {iconMap[variant]}
      </span>
      {title && <div className="ds-alert__title">{title}</div>}
      <div className="ds-alert__message">{message}</div>
    </div>
  );
}
