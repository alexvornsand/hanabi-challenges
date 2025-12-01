import type { InputHTMLAttributes, ReactElement } from 'react';
import './Checkbox.css';

export type CheckboxProps = {
  label?: string;
  helperText?: string;
  error?: string | null;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function Checkbox({
  label,
  helperText,
  error,
  className,
  id,
  ...rest
}: CheckboxProps): ReactElement {
  const inputId =
    id ?? (label ? `ds-checkbox-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;
  const hasError = Boolean(error);
  const rootClass = ['ds-checkbox-field', className].filter(Boolean).join(' ');
  const inputClass = ['ds-checkbox', hasError && 'ds-checkbox--error'].filter(Boolean).join(' ');

  return (
    <label className={rootClass} htmlFor={inputId}>
      <input
        id={inputId}
        type="checkbox"
        className={inputClass}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        {...rest}
      />
      {label && <span className="ds-checkbox-label">{label}</span>}
      {hasError ? (
        <span id={describedBy} className="ds-checkbox-helper ds-checkbox-helper--error">
          {error}
        </span>
      ) : helperText ? (
        <span id={describedBy} className="ds-checkbox-helper">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
