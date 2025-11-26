import React, { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import './Input.css';

type BaseProps = {
  label?: string;
  helperText?: string;
  error?: string | null;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
  className?: string;
  id?: string;
};

type TextInputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
    multiline?: false;
  };

type TextAreaProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> & {
    multiline: true;
    rows?: number;
  };

type InputProps = TextInputProps | TextAreaProps;

export function Input(props: InputProps) {
  const {
    label,
    helperText,
    error,
    size = 'md',
    fullWidth = false,
    className,
    id,
    multiline,
    ...rest
  } = props;

  const inputId = id ?? (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;
  const hasError = Boolean(error);
  const sizeClass = size === 'sm' ? 'ui-input--sm' : 'ui-input--md';
  const widthClass = fullWidth ? 'ui-input--full' : '';
  const errorClass = hasError ? 'ui-input--error' : '';
  const classes = ['ui-input', sizeClass, widthClass, errorClass, className].filter(Boolean).join(' ');

  return (
    <label className="ui-input-field">
      {label && (
        <span className="ui-input-label" htmlFor={inputId}>
          {label}
        </span>
      )}
      {multiline ? (
        <textarea
          id={inputId}
          className={classes}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          {...(rest as TextAreaProps)}
        />
      ) : (
        <input
          id={inputId}
          className={classes}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          {...(rest as TextInputProps)}
        />
      )}
      {hasError ? (
        <span id={describedBy} className="ui-input-helper ui-input-helper--error">
          {error}
        </span>
      ) : helperText ? (
        <span id={describedBy} className="ui-input-helper">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
