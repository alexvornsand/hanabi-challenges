import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactElement } from 'react';
import './Input.css';

type BaseProps = {
  label?: string;
  labelAction?: ReactElement | ReactElement[] | null;
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

export type InputProps = TextInputProps | TextAreaProps;

export function Input(props: InputProps): ReactElement {
  const {
    label,
    labelAction,
    helperText,
    error,
    size = 'md',
    fullWidth = false,
    className,
    id,
    multiline,
    ...rest
  } = props;

  const inputId =
    id ?? (label ? `ds-input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;
  const hasError = Boolean(error);
  const sizeClass = size === 'sm' ? 'ds-input--sm' : 'ds-input--md';
  const widthClass = fullWidth ? 'ds-input--full' : '';
  const errorClass = hasError ? 'ds-input--error' : '';
  const classes = ['ds-input', sizeClass, widthClass, errorClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <label className="ds-input-field">
      {(label || labelAction) && (
        <span className="ds-input-label-row">
          {label && (
            <span className="ds-input-label" htmlFor={inputId}>
              {label}
            </span>
          )}
          {labelAction}
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
        <span id={describedBy} className="ds-input-helper ds-input-helper--error">
          {error}
        </span>
      ) : helperText ? (
        <span id={describedBy} className="ds-input-helper">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
