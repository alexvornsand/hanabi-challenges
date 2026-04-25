import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Group, Tabs, Text, Modal, Checkbox, Stack, Tooltip } from '@mantine/core';
import { YamlEditor } from '../components/YamlEditor';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';
import { CompiledPreview } from '../components/CompiledPreview';
import { apiGet, apiPost } from '../api/client';
import { formatYaml } from '@hanabi/dsl/src/pipeline.js';
import type { Diagnostic, ExpandedConfig } from '@hanabi/dsl';
import { BadgeDesignerPopover } from '../components/editor/BadgeDesignerPopover';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SaveResponse {
  eventId: number;
  diagnostics: Diagnostic[];
  canSave: boolean;
  canPublish: boolean;
  expandedConfig?: ExpandedConfig;
}

interface LoadResponse {
  id: number;
  slug: string | null;
  name: string;
  status: string;
  yaml: string;
  diagnostics: Diagnostic[];
  canSave: boolean;
  canPublish: boolean;
  acknowledgedWarnings: string[];
  expandedConfig?: ExpandedConfig;
}

interface PublishResponse {
  ok: boolean;
  specsRegistered?: number;
}

// ---------------------------------------------------------------------------
// Template picker
// ---------------------------------------------------------------------------

const TEMPLATES: Array<{ label: string; yaml: string }> = [
  { label: 'Blank', yaml: 'event:\n  name: My Event\n  slug: my-event\n' },
  {
    label: 'NVC',
    yaml: `event:
  name: No Variant Challenge
  slug: nvc
  sections:
    - name: Main
      scoring_unit_type: individual
`,
  },
  {
    label: 'Mix Gauntlet',
    yaml: `event:
  name: Mix Gauntlet
  slug: mix-gauntlet
  sections:
    - name: Gauntlet
      scoring_unit_type: individual
`,
  },
  {
    label: 'Boom and Bloom',
    yaml: `event:
  name: Boom and Bloom
  slug: boom-and-bloom
  sections:
    - name: Week 1
      scoring_unit_type: team
`,
  },
];

function TemplatePicker({ onSelect }: { onSelect: (yaml: string) => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 8,
          padding: 32,
          minWidth: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <Text fw={600} size="lg" mb="md">
          Choose a template
        </Text>
        <Stack gap="sm">
          {TEMPLATES.map((t) => (
            <Button
              key={t.label}
              variant="default"
              fullWidth
              onClick={() => onSelect(t.yaml)}
            >
              {t.label}
            </Button>
          ))}
        </Stack>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Publish modal
// ---------------------------------------------------------------------------

interface PublishModalProps {
  warnings: Diagnostic[];
  onConfirm: (acknowledged: string[]) => void;
  onClose: () => void;
}

function PublishModal({ warnings, onConfirm, onClose }: PublishModalProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allChecked = warnings.every((w) => checked[w.code]);

  const toggle = (code: string) =>
    setChecked((prev) => ({ ...prev, [code]: !prev[code] }));

  return (
    <Modal opened onClose={onClose} title="Acknowledge warnings to publish">
      <Stack gap="sm">
        {warnings.map((w) => (
          <Checkbox
            key={w.code}
            label={
              <span>
                <strong>{w.code}</strong> — {w.message}
              </span>
            }
            checked={!!checked[w.code]}
            onChange={() => toggle(w.code)}
          />
        ))}
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!allChecked}
            onClick={() => onConfirm(warnings.map((w) => w.code))}
          >
            Publish
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// EventEditorPage
// ---------------------------------------------------------------------------

const HEADER_HEIGHT = 56;
const TABS_HEIGHT = 40;
const DIAGNOSTICS_HEIGHT = 200;
const TOOLBAR_HEIGHT = 52;

export function EventEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [yaml, setYaml] = useState('');
  const [eventId, setEventId] = useState<number | null>(id ? parseInt(id, 10) : null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [canSave, setCanSave] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [expandedConfig, setExpandedConfig] = useState<ExpandedConfig | null>(null);
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'yaml' | 'preview'>('yaml');
  const [jumpToLine, setJumpToLine] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(!id);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cursorLineText, setCursorLineText] = useState('');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing event on mount
  useEffect(() => {
    if (!id) return;
    apiGet<LoadResponse>(`/api/admin/events/${id}`)
      .then((data) => {
        setYaml(data.yaml);
        setDiagnostics(data.diagnostics);
        setCanSave(data.canSave);
        setCanPublish(data.canPublish);
        setExpandedConfig(data.expandedConfig ?? null);
        setAcknowledgedWarnings(new Set(data.acknowledgedWarnings));
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [id]);

  // Debounced auto-save on YAML change
  const handleYamlChange = useCallback(
    (newValue: string) => {
      setYaml(newValue);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        void doSave(newValue);
      }, 800);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId],
  );

  async function doSave(content: string) {
    const formatted = formatYaml(content);
    setSaving(true);
    try {
      if (eventId) {
        const res = await apiPost<SaveResponse>(`/api/admin/events/${eventId}/save`, {
          yaml: formatted,
        });
        setYaml(formatted);
        setDiagnostics(res.diagnostics);
        setCanSave(res.canSave);
        setCanPublish(res.canPublish);
        setExpandedConfig(res.expandedConfig ?? null);
      } else {
        // Create new event
        const res = await apiPost<SaveResponse & { eventId: number; slug: string | null }>(
          '/api/admin/events',
          { yaml: formatted },
        );
        setYaml(formatted);
        setDiagnostics(res.diagnostics);
        setCanSave(res.canSave);
        setCanPublish(res.canPublish);
        setExpandedConfig(res.expandedConfig ?? null);
        setEventId(res.eventId);
        navigate(`/admin/events/${res.eventId}/edit`, { replace: true });
      }
    } catch (e) {
      // Keep last known state on network error
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!eventId) return;
    const unacknowledgedWarnings = diagnostics.filter(
      (d) => d.severity === 'warning' && !acknowledgedWarnings.has(d.code),
    );
    if (unacknowledgedWarnings.length > 0) {
      setShowPublishModal(true);
      return;
    }
    await doPublish();
  }

  async function doPublish() {
    if (!eventId) return;
    setPublishing(true);
    try {
      await apiPost<PublishResponse>(`/api/admin/events/${eventId}/publish`, {});
      navigate('/admin/events');
    } catch (e) {
      // show error
    } finally {
      setPublishing(false);
      setShowPublishModal(false);
    }
  }

  async function handleModalConfirm(codes: string[]) {
    if (!eventId) return;
    // Acknowledge warnings one by one
    for (const code of codes) {
      try {
        await apiPost(`/api/admin/events/${eventId}/acknowledge-warning`, { warningCode: code });
        setAcknowledgedWarnings((prev) => new Set([...prev, code]));
      } catch {
        // ignore
      }
    }
    await doPublish();
  }

  if (loadError) {
    return <div style={{ padding: 24, color: '#ef4444' }}>Error loading event: {loadError}</div>;
  }

  const editorAreaHeight =
    `calc(100vh - ${HEADER_HEIGHT + TABS_HEIGHT + DIAGNOSTICS_HEIGHT + TOOLBAR_HEIGHT}px)`;

  const unacknowledgedWarnings = diagnostics.filter(
    (d) => d.severity === 'warning' && !acknowledgedWarnings.has(d.code),
  );
  const publishDisabled = !canPublish || unacknowledgedWarnings.length > 0;

  return (
    <div style={{ height: `calc(100vh - ${HEADER_HEIGHT}px)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {showTemplatePicker && (
        <TemplatePicker
          onSelect={(tmplYaml) => {
            setYaml(tmplYaml);
            setShowTemplatePicker(false);
          }}
        />
      )}

      {showPublishModal && (
        <PublishModal
          warnings={unacknowledgedWarnings}
          onConfirm={(codes) => void handleModalConfirm(codes)}
          onClose={() => setShowPublishModal(false)}
        />
      )}

      {/* Toolbar */}
      <div
        style={{
          height: TOOLBAR_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
        }}
      >
        <Text fw={500} size="sm" c="dimmed">
          {saving ? 'Saving…' : 'Event Editor'}
        </Text>
        <Group gap="sm">
          <BadgeDesignerPopover
            cursorLineText={cursorLineText}
            onInsert={(badgeYaml) => {
              // Insert badge YAML at end of current doc (simple insertion)
              setYaml((prev) => prev + '\n' + badgeYaml + '\n');
            }}
          />
          <Button
            size="sm"
            variant="default"
            disabled={saving}
            onClick={() => void doSave(yaml)}
          >
            Save
          </Button>
          <Tooltip
            label={!canPublish ? 'Fix errors before publishing' : undefined}
            disabled={canPublish}
          >
            <Button
              size="sm"
              disabled={publishDisabled || publishing}
              onClick={() => void handlePublish()}
            >
              Publish
            </Button>
          </Tooltip>
        </Group>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(v) => v && setActiveTab(v as 'yaml' | 'preview')}
        style={{ flexShrink: 0 }}
      >
        <Tabs.List>
          <Tabs.Tab value="yaml">YAML</Tabs.Tab>
          <Tabs.Tab value="preview">Preview</Tabs.Tab>
          <Tabs.Tab value="visual" disabled title="Coming soon">
            Visual Editor
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Editor area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeTab === 'yaml' && (
          <>
            <div style={{ height: editorAreaHeight, overflow: 'hidden' }}>
              <YamlEditor
                value={yaml}
                onChange={handleYamlChange}
                diagnostics={diagnostics}
                jumpToLine={jumpToLine}
                onCursorLineChange={setCursorLineText}
              />
            </div>
            <DiagnosticsPanel
              diagnostics={diagnostics}
              onJumpToLine={(line) => {
                setJumpToLine(line);
                setTimeout(() => setJumpToLine(undefined), 100);
              }}
            />
          </>
        )}
        {activeTab === 'preview' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <CompiledPreview expandedConfig={expandedConfig} />
          </div>
        )}
      </div>
    </div>
  );
}
