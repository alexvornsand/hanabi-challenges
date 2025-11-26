import React from 'react';
import './FormField.css';

type FormFieldProps = {
  label?: string;
  helperText?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
};

export function FormField({ label, helperText, error, children, className }: FormFieldProps) {
  const hasError = Boolean(error);
  return (
    <div className={['ui-form-field', className].filter(Boolean).join(' ')}>
      {label && <div className="ui-form-field__label">{label}</div>}
      <div
        className={['ui-form-field__control', hasError ? 'ui-form-field__control--error' : ''].filter(Boolean).join(' ')}
      >
        {children}
      </div>
      {hasError ? (
        <div className="ui-form-field__helper ui-form-field__helper--error">{error}</div>
      ) : helperText ? (
        <div className="ui-form-field__helper">{helperText}</div>
      ) : null}
    </div>
  );
}
