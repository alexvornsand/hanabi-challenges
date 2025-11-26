import React, { useRef } from 'react';
import './FileUpload.css';

type FileUploadProps = {
  label?: string;
  helperText?: string;
  error?: string | null;
  accept?: string;
  onFileSelected?: (file: File | null) => void;
  className?: string;
  id?: string;
};

export function FileUpload({
  label,
  helperText,
  error,
  accept = '.svg',
  onFileSelected,
  className,
  id,
}: FileUploadProps) {
  const inputId = id ?? (label ? `upload-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined;
  const hasError = Boolean(error);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    onFileSelected?.(file);
  };

  return (
    <label className={['ui-upload-field', className].filter(Boolean).join(' ')}>
      {label && (
        <span className="ui-upload-label" htmlFor={inputId}>
          {label}
        </span>
      )}
      <div
        className={['ui-upload-control', hasError ? 'ui-upload-control--error' : ''].filter(Boolean).join(' ')}
        onClick={() => fileInputRef.current?.click()}
      >
        <span>Choose file</span>
        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="ui-upload-input"
          onChange={handleChange}
          aria-invalid={hasError}
          aria-describedby={describedBy}
        />
      </div>
      {hasError ? (
        <span id={describedBy} className="ui-upload-helper ui-upload-helper--error">
          {error}
        </span>
      ) : helperText ? (
        <span id={describedBy} className="ui-upload-helper">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
