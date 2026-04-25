import React from 'react';
import type { Diagnostic } from '@hanabi/dsl';

export interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
  onJumpToLine?: (line: number) => void;
}

const SEVERITY_COLORS = {
  error: { bg: '#fef2f2', border: '#fecaca', badge: '#ef4444', label: 'error' },
  warning: { bg: '#fffbeb', border: '#fed7aa', badge: '#f59e0b', label: 'warning' },
  notice: { bg: '#eff6ff', border: '#bfdbfe', badge: '#3b82f6', label: 'notice' },
} as const;

const ORDER: Diagnostic['severity'][] = ['error', 'warning', 'notice'];

export function DiagnosticsPanel({ diagnostics, onJumpToLine }: DiagnosticsPanelProps) {
  if (diagnostics.length === 0) return null;

  const bySeverity: Record<string, Diagnostic[]> = { error: [], warning: [], notice: [] };
  for (const d of diagnostics) {
    bySeverity[d.severity].push(d);
  }

  return (
    <div
      style={{
        borderTop: '1px solid #e5e7eb',
        fontFamily: 'monospace',
        fontSize: 13,
        maxHeight: 200,
        overflowY: 'auto',
      }}
      aria-label="Diagnostics panel"
    >
      {ORDER.flatMap((sev) =>
        bySeverity[sev].map((d, i) => {
          const colors = SEVERITY_COLORS[sev];
          const clickable = d.line != null && onJumpToLine;
          return (
            <div
              key={`${sev}-${i}`}
              onClick={() => clickable && onJumpToLine(d.line!)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '4px 10px',
                backgroundColor: colors.bg,
                borderLeft: `4px solid ${colors.badge}`,
                borderBottom: '1px solid ' + colors.border,
                cursor: clickable ? 'pointer' : 'default',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  padding: '1px 5px',
                  borderRadius: 3,
                  backgroundColor: colors.badge,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginTop: 1,
                }}
              >
                {colors.label}
              </span>
              <span style={{ color: '#374151', flexGrow: 1 }}>
                <span style={{ color: '#6b7280', marginRight: 6 }}>{d.code}</span>
                {d.message}
              </span>
              {d.line != null && (
                <span style={{ flexShrink: 0, color: '#9ca3af' }}>Ln {d.line}</span>
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}
