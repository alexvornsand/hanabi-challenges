import React, { useState } from 'react';
import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import type { BadgeConfig } from '@hanabi/dsl';
import { COLOUR_HEX, ALL_COLOUR_TOKENS } from '../../lib/colourTokens';
import { BadgeSvg } from '../badges/BadgeSvg';
import { badgeConfigToYaml } from '@hanabi/dsl/src/lib/badgeYaml.js';

// ---------------------------------------------------------------------------
// Colour swatch picker
// ---------------------------------------------------------------------------

function ColourSwatchPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (token: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {ALL_COLOUR_TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          title={token}
          onClick={() => onChange(token)}
          style={{
            width: 20,
            height: 20,
            background: COLOUR_HEX[token].light,
            border: value === token ? '2px solid #000' : '1px solid #ccc',
            borderRadius: 3,
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label={token}
          aria-pressed={value === token}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BadgeDesignerModal
// ---------------------------------------------------------------------------

interface BadgeDesignerModalProps {
  opened: boolean;
  onClose: () => void;
  /** Called with the YAML string to insert */
  onInsert: (yaml: string) => void;
  /** Initial values parsed from current cursor context, if any */
  initialConfig?: Partial<BadgeConfig>;
}

const DEFAULT_CONFIG: BadgeConfig = {
  primary_text: 'Winner',
  secondary_text: 'Event',
  colour: 'gold',
  shape: 'circle',
  size: 'regular',
  icon: 'emoji_events',
};

const SHAPE_OPTIONS = [
  { value: 'circle', label: 'Circle' },
  { value: 'shield', label: 'Shield' },
  { value: 'hex', label: 'Hexagon' },
  { value: 'ribbon', label: 'Ribbon' },
  { value: 'star', label: 'Star' },
];

const SIZE_OPTIONS = [
  { value: 'regular', label: 'Regular (48px)' },
  { value: 'large', label: 'Large (96px)' },
];

const ICON_OPTIONS = [
  { value: 'star', label: 'Star' },
  { value: 'emoji_events', label: 'Trophy' },
  { value: 'military_tech', label: 'Military Tech' },
  { value: 'workspace_premium', label: 'Premium' },
  { value: 'verified', label: 'Verified' },
  { value: 'diamond', label: 'Diamond' },
];

export function BadgeDesignerModal({ opened, onClose, onInsert, initialConfig }: BadgeDesignerModalProps) {
  const [config, setConfig] = useState<BadgeConfig>({ ...DEFAULT_CONFIG, ...initialConfig });

  function set<K extends keyof BadgeConfig>(key: K, val: BadgeConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: val }));
  }

  function handleInsert() {
    onInsert(badgeConfigToYaml(config));
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Badge Designer" size="lg">
      <Group align="flex-start" gap="lg">
        {/* Controls */}
        <Stack style={{ flex: 1 }} gap="sm">
          <TextInput
            label="Primary text"
            value={config.primary_text}
            onChange={(e) => set('primary_text', e.currentTarget.value)}
          />
          <TextInput
            label="Secondary text"
            value={config.secondary_text ?? ''}
            onChange={(e) => set('secondary_text', e.currentTarget.value || undefined)}
          />
          <Select
            label="Shape"
            data={SHAPE_OPTIONS}
            value={config.shape ?? 'circle'}
            onChange={(v) => v && set('shape', v as BadgeConfig['shape'])}
          />
          <Select
            label="Size"
            data={SIZE_OPTIONS}
            value={config.size ?? 'regular'}
            onChange={(v) => v && set('size', v as BadgeConfig['size'])}
          />
          <Select
            label="Icon"
            data={ICON_OPTIONS}
            value={config.icon ?? 'star'}
            onChange={(v) => v && set('icon', v)}
            clearable
          />
          <Stack gap={4}>
            <Text size="sm" fw={500}>Colour</Text>
            <ColourSwatchPicker
              value={config.colour}
              onChange={(token) => set('colour', token as BadgeConfig['colour'])}
            />
          </Stack>
        </Stack>

        {/* Preview */}
        <Stack align="center" gap="sm">
          <Text size="sm" fw={500}>Preview</Text>
          <BadgeSvg config={config} style={{ width: 96, height: 96 }} />
          <Text size="xs" c="dimmed">{config.colour}</Text>
        </Stack>
      </Group>

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>Cancel</Button>
        <Button onClick={handleInsert}>Insert into YAML</Button>
      </Group>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// BadgeDesignerPopover — toolbar button that opens the modal
// ---------------------------------------------------------------------------

interface BadgeDesignerPopoverProps {
  /** Current cursor line text — used to detect badge: context */
  cursorLineText: string;
  /** Called with the YAML string when user clicks Insert */
  onInsert: (yaml: string) => void;
}

export function BadgeDesignerPopover({ cursorLineText, onInsert }: BadgeDesignerPopoverProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const isBadgeLine = /^\s*badge\s*:/i.test(cursorLineText);

  if (!isBadgeLine) return null;

  return (
    <>
      <Button
        size="xs"
        variant="light"
        onClick={() => setModalOpen(true)}
      >
        Design badge
      </Button>
      <BadgeDesignerModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onInsert={onInsert}
      />
    </>
  );
}
