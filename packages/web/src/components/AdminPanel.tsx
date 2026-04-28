import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionIcon,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAuth } from '../lib/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ControlType =
  | 'datetime'
  | 'integer'
  | 'unit_list'
  | 'checkbox_list'
  | 'trigger_button'
  | 'iteration_control';

interface PendingInput {
  fieldPath: string;
  description: string;
  controlType: ControlType;
  currentValue: unknown;
  isActionable: boolean;
  divisionCount: number;
}

interface ManageResponse {
  pendingInputs: PendingInput[];
  scrapeSchedule: string | null;
}

interface AdminPanelProps {
  eventId: number;
  slug: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function postInput(eventId: number, fieldPath: string, value: unknown): Promise<void> {
  const res = await fetch(
    `http://localhost:3001/api/admin/events/${eventId}/inputs/${encodeURIComponent(fieldPath)}`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value }),
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Error ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// SortableItem for unit_list
// ---------------------------------------------------------------------------

function SortableItem({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const transformStr = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
    : undefined;
  const style = {
    transform: transformStr,
    transition,
    padding: '4px 8px',
    border: '1px solid var(--mantine-color-gray-3)',
    borderRadius: 4,
    background: 'var(--mantine-color-body)',
    cursor: 'grab',
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      ⠿ {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Control renderers
// ---------------------------------------------------------------------------

function DatetimeControl({
  input,
  eventId,
  onSuccess,
}: {
  input: PendingInput;
  eventId: number;
  onSuccess: () => void;
}) {
  const [value, setValue] = useState<Date | null>(
    typeof input.currentValue === 'string' ? new Date(input.currentValue) : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      await postInput(eventId, input.fieldPath, value.toISOString());
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>{input.description}</Text>
      <DateTimePicker value={value} onChange={setValue} placeholder="Pick date & time" />
      {error && <Text size="xs" c="red">{error}</Text>}
      <Button size="xs" onClick={confirm} loading={saving} disabled={!value}>
        Confirm
      </Button>
    </Stack>
  );
}

function IntegerControl({
  input,
  eventId,
  onSuccess,
}: {
  input: PendingInput;
  eventId: number;
  onSuccess: () => void;
}) {
  const [value, setValue] = useState<number | string>(
    typeof input.currentValue === 'number' ? input.currentValue : 0,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await postInput(eventId, input.fieldPath, Number(value));
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>{input.description}</Text>
      <NumberInput value={value} onChange={setValue} step={1} />
      {error && <Text size="xs" c="red">{error}</Text>}
      <Button size="xs" onClick={confirm} loading={saving}>
        Confirm
      </Button>
    </Stack>
  );
}

function TriggerButtonControl({
  input,
  eventId,
  onSuccess,
}: {
  input: PendingInput;
  eventId: number;
  onSuccess: () => void;
}) {
  const [firing, setFiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fire() {
    setFiring(true);
    setError(null);
    try {
      await postInput(eventId, input.fieldPath, { action: 'trigger' });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFiring(false);
    }
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>{input.description}</Text>
      {error && <Text size="xs" c="red">{error}</Text>}
      <Button size="xs" onClick={fire} loading={firing}>
        Issue next slot
      </Button>
    </Stack>
  );
}

function IterationControl({
  input,
  eventId,
  onSuccess,
}: {
  input: PendingInput;
  eventId: number;
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(action: 'increment' | 'stop') {
    setSaving(true);
    setError(null);
    try {
      await postInput(eventId, input.fieldPath, { action });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>{input.description}</Text>
      {error && <Text size="xs" c="red">{error}</Text>}
      <Group gap="xs">
        <Button size="xs" onClick={() => send('increment')} loading={saving}>
          +1
        </Button>
        <Button size="xs" variant="outline" color="red" onClick={() => send('stop')} loading={saving}>
          Stop
        </Button>
      </Group>
    </Stack>
  );
}

function UnitListControl({
  input,
  eventId,
  onSuccess,
}: {
  input: PendingInput;
  eventId: number;
  onSuccess: () => void;
}) {
  const initial = Array.isArray(input.currentValue)
    ? (input.currentValue as string[])
    : ['Unit A', 'Unit B', 'Unit C'];
  const [items, setItems] = useState<string[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await postInput(eventId, input.fieldPath, items);
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>{input.description}</Text>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <Stack gap={4}>
            {items.map((item) => (
              <SortableItem key={item} id={item} label={item} />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
      {error && <Text size="xs" c="red">{error}</Text>}
      <Button size="xs" onClick={confirm} loading={saving}>
        Confirm order
      </Button>
    </Stack>
  );
}

type AdvancementDecision = 'advance' | 'hold' | 'eliminate';

function CheckboxListControl({
  input,
  eventId,
  onSuccess,
}: {
  input: PendingInput;
  eventId: number;
  onSuccess: () => void;
}) {
  const initial = Array.isArray(input.currentValue)
    ? (input.currentValue as Array<{ unitId: number; unitName: string; decision: AdvancementDecision }>)
    : [];
  const [decisions, setDecisions] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setDecision(unitId: number, decision: AdvancementDecision) {
    setDecisions((prev) =>
      prev.map((d) => (d.unitId === unitId ? { ...d, decision } : d)),
    );
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await postInput(eventId, input.fieldPath, decisions);
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (decisions.length === 0) {
    return (
      <Stack gap="xs">
        <Text size="sm" fw={500}>{input.description}</Text>
        <Text size="xs" c="dimmed">No units to decide.</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>{input.description}</Text>
      {decisions.map((d) => (
        <Group key={d.unitId} justify="space-between" align="center">
          <Text size="sm">{d.unitName}</Text>
          <Select
            size="xs"
            value={d.decision}
            onChange={(val) => val && setDecision(d.unitId, val as AdvancementDecision)}
            data={[
              { value: 'advance', label: 'Advance' },
              { value: 'hold', label: 'Hold' },
              { value: 'eliminate', label: 'Eliminate' },
            ]}
            style={{ width: 120 }}
          />
        </Group>
      ))}
      {error && <Text size="xs" c="red">{error}</Text>}
      <Button size="xs" onClick={confirm} loading={saving}>
        Confirm decisions
      </Button>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// AdminPanel
// ---------------------------------------------------------------------------

export function AdminPanel({ eventId, slug: _slug }: AdminPanelProps) {
  const { user } = useAuth();
  const [opened, setOpened] = useState(false);
  const [manage, setManage] = useState<ManageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);

  const fetchManage = useCallback(() => {
    if (!user?.isOrganiser) return;
    setLoading(true);
    fetch(`http://localhost:3001/api/admin/events/${eventId}/manage`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setManage(data as ManageResponse | null))
      .catch(() => setManage(null))
      .finally(() => setLoading(false));
  }, [eventId, user?.isOrganiser]);

  useEffect(() => {
    fetchManage();
  }, [fetchManage]);

  if (!user?.isOrganiser) return null;

  async function scrapeNow() {
    setScraping(true);
    setScrapeMsg(null);
    try {
      const res = await fetch(`http://localhost:3001/api/admin/events/${eventId}/scrape`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { gamesInserted?: number; error?: string };
      if (res.ok) {
        setScrapeMsg(`Scraped: ${data.gamesInserted ?? 0} new game(s)`);
      } else {
        setScrapeMsg(data.error ?? 'Scrape failed');
      }
    } catch {
      setScrapeMsg('Scrape failed');
    } finally {
      setScraping(false);
    }
  }

  const actionableInputs = manage?.pendingInputs.filter((p) => p.isActionable) ?? [];
  const showScrape = manage?.scrapeSchedule === 'on_demand';

  return (
    <>
      {/* Floating action button */}
      <Tooltip label="Admin panel" position="left">
        <ActionIcon
          variant="filled"
          color="blue"
          size="xl"
          radius="xl"
          aria-label="Open admin panel"
          onClick={() => setOpened(true)}
          style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200 }}
        >
          ⚙
        </ActionIcon>
      </Tooltip>

      {/* Side drawer */}
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title="Admin Panel"
        position="right"
        size="md"
      >
        <Stack gap="md">
          <Button
            component={Link}
            to={`/admin/events/${eventId}/edit`}
            variant="subtle"
            size="sm"
            fullWidth
          >
            Edit config
          </Button>

          <Divider />

          {loading && <Loader size="sm" />}

          {!loading && showScrape && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>Scrape games</Text>
              {scrapeMsg && <Text size="xs" c="dimmed">{scrapeMsg}</Text>}
              <Button size="xs" onClick={scrapeNow} loading={scraping}>
                Scrape now
              </Button>
            </Stack>
          )}

          {!loading && actionableInputs.length === 0 && !showScrape && (
            <Text size="sm" c="dimmed">No pending admin actions.</Text>
          )}

          {actionableInputs.map((input) => (
            <React.Fragment key={input.fieldPath}>
              <Divider />
              {input.controlType === 'datetime' && (
                <DatetimeControl input={input} eventId={eventId} onSuccess={fetchManage} />
              )}
              {input.controlType === 'integer' && (
                <IntegerControl input={input} eventId={eventId} onSuccess={fetchManage} />
              )}
              {input.controlType === 'trigger_button' && (
                <TriggerButtonControl input={input} eventId={eventId} onSuccess={fetchManage} />
              )}
              {input.controlType === 'iteration_control' && (
                <IterationControl input={input} eventId={eventId} onSuccess={fetchManage} />
              )}
              {input.controlType === 'unit_list' && (
                <UnitListControl input={input} eventId={eventId} onSuccess={fetchManage} />
              )}
              {input.controlType === 'checkbox_list' && (
                <CheckboxListControl input={input} eventId={eventId} onSuccess={fetchManage} />
              )}
            </React.Fragment>
          ))}
        </Stack>
      </Drawer>
    </>
  );
}
