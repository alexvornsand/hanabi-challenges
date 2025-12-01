import type { ReactElement } from 'react';
import './Select.css';

export type SelectOption = { value: string; label: string };

type SelectProps = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function Select({
  options,
  value,
  onChange,
  disabled,
  className,
  placeholder,
}: SelectProps): ReactElement {
  return (
    <select
      className={['ds-select', className].filter(Boolean).join(' ')}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
