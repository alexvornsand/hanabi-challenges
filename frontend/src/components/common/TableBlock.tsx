import React, { useState } from 'react';

type TableBlockProps = {
  title: string;
  subtitle?: React.ReactNode;
  kpis?: React.ReactNode;
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
};

export function TableBlock({
  title,
  subtitle,
  kpis,
  actions,
  collapsible = false,
  defaultCollapsed = false,
  children,
  className,
  id,
}: TableBlockProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const handleToggle = () => {
    if (!collapsible) return;
    setCollapsed((prev) => !prev);
  };

  return (
    <div
      id={id}
      className={['ui-card', 'stack-sm', className].filter(Boolean).join(' ')}
      style={{ padding: 'var(--space-md)' }}
    >
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 'var(--space-sm)' }}>
        <div className="stack-xs" style={{ minWidth: '200px' }}>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold" style={{ margin: 0 }}>
              {title}
            </h2>
            {collapsible && (
              <button
                className="ui-btn ui-btn--secondary ui-btn--sm"
                onClick={handleToggle}
                type="button"
                style={{ padding: '4px 8px' }}
              >
                {collapsed ? 'Show' : 'Hide'}
              </button>
            )}
          </div>
          {subtitle && (
            <div className="text-sm text-gray-700" style={{ margin: 0 }}>
              {subtitle}
            </div>
          )}
        </div>
        {kpis && <div className="flex flex-wrap" style={{ gap: 'var(--space-sm)' }}>{kpis}</div>}
        {actions && <div className="flex" style={{ gap: 'var(--button-gap-group)' }}>{actions}</div>}
      </div>

      {!collapsed && <div>{children}</div>}
    </div>
  );
}
