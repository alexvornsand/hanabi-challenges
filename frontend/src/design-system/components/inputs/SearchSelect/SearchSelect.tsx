import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Inline } from '../../layout/Inline/Inline';
import './SearchSelect.css';

export type SearchSuggestion<T> = {
  key: string | number;
  node: ReactNode;
  value: T;
};

export type SearchSelectProps<T> = {
  value: string;
  onChange: (next: string) => void;
  suggestions: Array<SearchSuggestion<T>>;
  onSelect: (value: T) => void;
  onSubmitFreeText?: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxSelections?: number;
  selectedCount?: number;
  tokens?: ReactNode[];
};

export function SearchSelect<T>({
  value,
  onChange,
  suggestions,
  onSelect,
  onSubmitFreeText,
  placeholder,
  disabled = false,
  maxSelections,
  selectedCount = 0,
  tokens = [],
}: SearchSelectProps<T>): ReactElement {
  const reachedLimit = maxSelections !== undefined && selectedCount >= maxSelections;
  const isDisabled = disabled || reachedLimit;
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHighlightIndex(0);
  }, [suggestions.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isDisabled) return;
    if (suggestions.length === 0) {
      if (e.key === 'Enter' && onSubmitFreeText) {
        e.preventDefault();
        onSubmitFreeText();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const choice = suggestions[highlightIndex];
      if (choice) onSelect(choice.value);
    }
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="true"]') as HTMLButtonElement | null;
    if (active) {
      const viewTop = el.scrollTop;
      const viewBottom = el.scrollTop + el.clientHeight;
      const itemTop = active.offsetTop;
      const itemBottom = itemTop + active.offsetHeight;
      if (itemTop < viewTop) el.scrollTop = itemTop;
      else if (itemBottom > viewBottom) el.scrollTop = itemBottom - el.clientHeight;
    }
  }, [highlightIndex, suggestions.length]);

  return (
    <div className="ds-search-select">
      <div className={`ds-search-select__control${isDisabled ? ' is-disabled' : ''}`}>
        {tokens.map((token, idx) => (
          <span key={idx} className="ds-search-select__token">
            {token}
          </span>
        ))}
        <input
          className="ds-search-select__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isDisabled ? '' : placeholder}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
        />
      </div>
      {!isDisabled && suggestions.length > 0 && (
        <div className="ds-search-select__list" ref={listRef}>
          {suggestions.map((s, idx) => {
            const active = idx === highlightIndex;
            return (
              <button
                key={s.key}
                type="button"
                className={`ds-search-select__item${active ? ' is-active' : ''}`}
                data-active={active || undefined}
                onMouseEnter={() => setHighlightIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(s.value);
                }}
              >
                <Inline gap="xs" align="center">
                  {s.node}
                </Inline>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
