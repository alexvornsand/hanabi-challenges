import React, { useEffect, useRef } from 'react';
import { EditorView, gutter, GutterMarker, keymap as cmKeymap } from '@codemirror/view';
import { EditorState, StateField, StateEffect, RangeSet, RangeSetBuilder } from '@codemirror/state';
import { foldGutter, foldKeymap } from '@codemirror/language';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import { useMantineColorScheme } from '@mantine/core';
import type { Diagnostic } from '@hanabi/dsl';

// ---------------------------------------------------------------------------
// Gutter markers
// ---------------------------------------------------------------------------

class SeverityMarker extends GutterMarker {
  constructor(private severity: 'error' | 'warning' | 'notice') {
    super();
  }

  toDOM() {
    const el = document.createElement('span');
    el.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 2px;';
    el.style.backgroundColor =
      this.severity === 'error' ? '#ef4444' : this.severity === 'warning' ? '#f59e0b' : '#3b82f6';
    el.title = this.severity;
    return el;
  }

  eq(other: GutterMarker) {
    return other instanceof SeverityMarker && other.severity === this.severity;
  }
}

// Effect to update diagnostics in the state
const setDiagnosticsEffect = StateEffect.define<Diagnostic[]>();

// State field holding a RangeSet of gutter markers keyed by line position
const diagnosticMarkersField = StateField.define<RangeSet<GutterMarker>>({
  create() {
    return RangeSet.empty;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        const builder = new RangeSetBuilder<GutterMarker>();
        const diags = effect.value;
        // Sort by line so builder receives them in order
        const sorted = [...diags]
          .filter((d) => d.line != null)
          .sort((a, b) => (a.line ?? 1) - (b.line ?? 1));
        const withFallback = diags.filter((d) => d.line == null).map((d) => ({ ...d, line: 1 }));
        const all = [...sorted, ...withFallback].sort((a, b) => (a.line ?? 1) - (b.line ?? 1));
        for (const d of all) {
          const lineNo = d.line ?? 1;
          if (lineNo < 1 || lineNo > tr.state.doc.lines) continue;
          const line = tr.state.doc.line(lineNo);
          builder.add(line.from, line.from, new SeverityMarker(d.severity));
        }
        return builder.finish();
      }
    }
    if (tr.docChanged) {
      // Remap marker positions after doc changes
      return value.map(tr.changes);
    }
    return value;
  },
});

const diagnosticGutter = gutter({
  class: 'cm-diagnostic-gutter',
  markers: (view) => view.state.field(diagnosticMarkersField),
  initialSpacer: () => new SeverityMarker('notice'),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics?: Diagnostic[];
  jumpToLine?: number;
  readOnly?: boolean;
  /** Called on cursor position change with the text of the current line */
  onCursorLineChange?: (lineText: string) => void;
}

export function YamlEditor({ value, onChange, diagnostics = [], jumpToLine, readOnly = false, onCursorLineChange }: YamlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { colorScheme } = useMantineColorScheme();

  // Create the editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      basicSetup,
      yaml(),
      foldGutter(),
      cmKeymap.of(foldKeymap),
      diagnosticMarkersField,
      diagnosticGutter,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
        if ((update.docChanged || update.selectionSet) && onCursorLineChange) {
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          onCursorLineChange(line.text);
        }
      }),
      EditorView.editable.of(!readOnly),
      colorScheme === 'dark' ? oneDark : [],
    ];

    const state = EditorState.create({ doc: value, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorScheme]);

  // Sync value from outside (e.g. template change) without triggering onChange loop
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // Sync diagnostics into editor state
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: [setDiagnosticsEffect.of(diagnostics)] });
  }, [diagnostics]);

  // Jump to line when requested
  useEffect(() => {
    const view = viewRef.current;
    if (!view || jumpToLine == null) return;
    const line = Math.max(1, Math.min(jumpToLine, view.state.doc.lines));
    const pos = view.state.doc.line(line).from;
    view.dispatch({
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
    });
  }, [jumpToLine]);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', overflow: 'hidden', fontSize: 14 }}
    />
  );
}
