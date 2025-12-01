import type { ReactElement, InputHTMLAttributes } from 'react';
import './ToggleSwitch.css';

type ToggleSwitchProps = {
  label?: string;
  helperText?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function ToggleSwitch({ label, helperText, id, ...rest }: ToggleSwitchProps): ReactElement {
  const inputId =
    id ?? (label ? `ds-toggle-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <label className="ds-toggle" htmlFor={inputId}>
      <input id={inputId} type="checkbox" className="ds-toggle__input" {...rest} />
      <span className="ds-toggle__track">
        <span className="ds-toggle__thumb" />
      </span>
      {label && <span className="ds-toggle__label">{label}</span>}
      {helperText && <span className="ds-toggle__helper">{helperText}</span>}
    </label>
  );
}
