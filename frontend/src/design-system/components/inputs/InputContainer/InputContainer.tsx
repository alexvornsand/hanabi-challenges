import type { ReactElement, ReactNode } from 'react';
import './InputContainer.css';

type InputContainerProps = {
  label?: string;
  helperText?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
  labelAction?: ReactNode;
};

/**
 * InputContainer
 * Wraps a label + control + helper/error text with standardized spacing and alignment.
 */
export function InputContainer({
  label,
  helperText,
  error,
  children,
  className,
  labelAction,
}: InputContainerProps): ReactElement {
  const hasError = Boolean(error);
  return (
    <div className={['ds-input-container', className].filter(Boolean).join(' ')}>
      {label && (
        <div className="ds-input-container__label-row">
          <div className="ds-input-container__label">{label}</div>
          {labelAction}
        </div>
      )}
      <div
        className={[
          'ds-input-container__control',
          hasError ? 'ds-input-container__control--error' : undefined,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
      {hasError ? (
        <div className="ds-input-container__helper ds-input-container__helper--error">{error}</div>
      ) : helperText ? (
        <div className="ds-input-container__helper">{helperText}</div>
      ) : null}
    </div>
  );
}
