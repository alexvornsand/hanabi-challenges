import React, { InputHTMLAttributes } from 'react';
import './Radio.css';

type RadioProps = {
  label?: string;
  helperText?: string;
  error?: string | null;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function Radio({ label, helperText, error, className, id, ...rest }: RadioProps) {
  const inputId = id ?? (label ? `radio-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;
  const hasError = Boolean(error);
  const classes = ['ui-radio', hasError ? 'ui-radio--error' : '', className].filter(Boolean).join(' ');

  return (
    <label className="ui-radio-field" htmlFor={inputId}>
      <input
        id={inputId}
        type="radio"
        className={classes}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        {...rest}
      />
      {label && <span className="ui-radio-label">{label}</span>}
      {hasError ? (
        <span id={describedBy} className="ui-radio-helper ui-radio-helper--error">
          {error}
        </span>
      ) : helperText ? (
        <span id={describedBy} className="ui-radio-helper">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
