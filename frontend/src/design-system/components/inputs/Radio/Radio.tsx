import type { InputHTMLAttributes, ReactElement } from 'react';
import './Radio.css';

export type RadioProps = {
  label?: string;
  helperText?: string;
  error?: string | null;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function Radio({
  label,
  helperText,
  error,
  className,
  id,
  ...rest
}: RadioProps): ReactElement {
  const inputId =
    id ?? (label ? `ds-radio-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;
  const hasError = Boolean(error);
  const rootClass = ['ds-radio-field', className].filter(Boolean).join(' ');
  const inputClass = ['ds-radio', hasError && 'ds-radio--error'].filter(Boolean).join(' ');

  return (
    <label className={rootClass} htmlFor={inputId}>
      <input
        id={inputId}
        type="radio"
        className={inputClass}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        {...rest}
      />
      {label && <span className="ds-radio-label">{label}</span>}
      {hasError ? (
        <span id={describedBy} className="ds-radio-helper ds-radio-helper--error">
          {error}
        </span>
      ) : helperText ? (
        <span id={describedBy} className="ds-radio-helper">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
