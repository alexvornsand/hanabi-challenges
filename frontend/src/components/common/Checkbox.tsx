import React, { InputHTMLAttributes } from 'react';
import './Checkbox.css';

type CheckboxProps = {
  label?: string;
  helperText?: string;
  error?: string | null;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function Checkbox({ label, helperText, error, className, id, ...rest }: CheckboxProps) {
  const inputId = id ?? (label ? `checkbox-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;
  const hasError = Boolean(error);
  const classes = ['ui-checkbox', hasError ? 'ui-checkbox--error' : '', className].filter(Boolean).join(' ');

  return (
    <label className="ui-checkbox-field" htmlFor={inputId}>
      <input
        id={inputId}
        type="checkbox"
        className={classes}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        {...rest}
      />
      {label && <span className="ui-checkbox-label">{label}</span>}
      {hasError ? (
        <span id={describedBy} className="ui-checkbox-helper ui-checkbox-helper--error">
          {error}
        </span>
      ) : helperText ? (
        <span id={describedBy} className="ui-checkbox-helper">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
