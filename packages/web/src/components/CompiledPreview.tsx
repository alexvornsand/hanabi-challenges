import React, { useState } from 'react';
import type { AggregationFunction, ExpandedConfig, ExpandedSection, SlotSource } from '@hanabi/dsl';
import { COLOUR_HEX } from '../lib/colourTokens';

function aggLabel(agg: AggregationFunction): string {
  if ('fn' in agg) return agg.fn;
  return 'aggregate';
}

function isDeferred(slot: SlotSource): slot is Extract<SlotSource, { kind: 'deferred' }> {
  return 'kind' in slot && slot.kind === 'deferred';
}

// ---------------------------------------------------------------------------
// Slot list (first 5, "…N more…", last 5)
// ---------------------------------------------------------------------------

function SlotList({ slots }: { slots: SlotSource[] }) {
  const SHOW_EDGE = 5;

  if (slots.length === 0) return <span style={{ color: '#9ca3af' }}>No slots</span>;

  const renderSlot = (slot: SlotSource, i: number) => {
    if (isDeferred(slot)) {
      return (
        <div key={i} style={{ color: '#6b7280', fontStyle: 'italic', fontSize: 12, marginBottom: 2 }}>
          Slots on {slot.trigger_type}
        </div>
      );
    }
    const seed = slot.seed_pattern ?? '';
    return (
      <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 2 }}>
        <code style={{ backgroundColor: '#f3f4f6', padding: '1px 4px', borderRadius: 2 }}>
          {seed || `slot ${slot.slot_index}`}
        </code>
      </div>
    );
  };

  if (slots.length <= SHOW_EDGE * 2) {
    return <>{slots.map((s, i) => renderSlot(s, i))}</>;
  }

  const hidden = slots.length - SHOW_EDGE * 2;
  return (
    <>
      {slots.slice(0, SHOW_EDGE).map((s, i) => renderSlot(s, i))}
      <div style={{ color: '#9ca3af', fontSize: 12, margin: '2px 0', fontStyle: 'italic' }}>
        … {hidden} more …
      </div>
      {slots.slice(-SHOW_EDGE).map((s, i) => renderSlot(s, slots.length - SHOW_EDGE + i))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Award previews
// ---------------------------------------------------------------------------

function AwardList({ awards }: { awards: ExpandedSection['awards'] }) {
  if (!awards.length) return null;
  return (
    <div style={{ marginTop: 4 }}>
      {awards.map((a, i) => {
        const hex = a.badge?.colour ? COLOUR_HEX[a.badge.colour]?.light ?? '#ccc' : '#ccc';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, fontSize: 12 }}>
            <span
              style={{
                width: 12,
                height: 12,
                backgroundColor: hex,
                border: '1px solid rgba(0,0,0,0.15)',
                borderRadius: a.badge?.shape === 'circle' ? '50%' : 2,
                flexShrink: 0,
              }}
            />
            <span style={{ color: '#374151' }}>{a.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row styles
// ---------------------------------------------------------------------------

function RowStyleList({ rowStyles }: { rowStyles: ExpandedSection['routing'] }) {
  // row_styles are on the routing block
  const rules = (rowStyles as { row_styles?: Array<{ accent?: string; label?: string }> } | undefined)?.row_styles ?? [];
  if (!rules.length) return null;
  return (
    <div style={{ marginTop: 4 }}>
      {rules.map((r, i) => {
        const hex = r.accent ? COLOUR_HEX[r.accent as import('@hanabi/dsl').ColourToken]?.light ?? '#ccc' : '#ccc';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, fontSize: 12 }}>
            <span style={{ width: 4, height: 14, backgroundColor: hex, flexShrink: 0 }} />
            <span style={{ color: '#6b7280' }}>{r.label ?? r.accent ?? 'style'}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section tree node
// ---------------------------------------------------------------------------

function SectionNode({ section, depth = 0 }: { section: ExpandedSection; depth?: number }) {
  const [open, setOpen] = useState(true);
  const indent = depth * 16;

  return (
    <div style={{ marginLeft: indent, marginBottom: 6 }}>
      {/* Header row */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: 3,
          backgroundColor: depth === 0 ? '#f9fafb' : 'transparent',
          border: depth === 0 ? '1px solid #e5e7eb' : 'none',
        }}
      >
        <span style={{ color: '#9ca3af', fontSize: 11, userSelect: 'none' }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{section.name}</span>
        <span style={{ color: '#6b7280', fontSize: 11 }}>
          [{section.scoring_unit_type}
          {section.aggregation_function ? ` · ${aggLabel(section.aggregation_function)}` : ''}]
        </span>
      </div>

      {open && (
        <div style={{ paddingTop: 4 }}>
          {/* Time window admin flag */}
          {(section.time_window?.start === 'admin' || section.time_window?.end === 'admin') && (
            <div style={{ color: '#f59e0b', fontSize: 11, marginLeft: 4, marginBottom: 2 }}>
              [Admin input required: time_window]
            </div>
          )}

          {/* Scoreboards */}
          {section.scoreboards?.length > 0 && (
            <div style={{ marginLeft: 4, marginBottom: 4 }}>
              {section.scoreboards.map((sb, i) => (
                <div key={i} style={{ fontSize: 12, color: '#6b7280' }}>
                  Scoreboard: rank by {sb.rank_by?.primary?.expr ?? '—'}
                </div>
              ))}
            </div>
          )}

          {/* Row styles */}
          <RowStyleList rowStyles={section.routing} />

          {/* Awards */}
          <AwardList awards={section.awards} />

          {/* Slots */}
          {section.slots?.length > 0 && (
            <div style={{ marginLeft: 4, marginTop: 4 }}>
              <SlotList slots={section.slots} />
            </div>
          )}

          {/* Child sections */}
          {section.sections?.map((child, i) => (
            <SectionNode key={i} section={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompiledPreview
// ---------------------------------------------------------------------------

export interface CompiledPreviewProps {
  expandedConfig: ExpandedConfig | null;
}

export function CompiledPreview({ expandedConfig }: CompiledPreviewProps) {
  if (!expandedConfig) {
    return (
      <div
        style={{
          padding: '24px 16px',
          color: '#9ca3af',
          fontStyle: 'italic',
          fontSize: 13,
          textAlign: 'center',
        }}
      >
        Fix errors above to see preview.
      </div>
    );
  }

  return (
    <div style={{ padding: 12, fontFamily: 'monospace', fontSize: 12, overflowY: 'auto', height: '100%' }}>
      <SectionNode section={expandedConfig.root} />
    </div>
  );
}
