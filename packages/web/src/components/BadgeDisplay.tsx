import React from 'react';
import { Group, Stack, Text, Tooltip } from '@mantine/core';
import type { BadgeConfig } from '@hanabi/dsl';
import { BadgeSvg } from './badges/BadgeSvg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BadgeItem {
  awardName: string;
  issuedAt: string;
  eventName: string;
  badgeConfig: BadgeConfig;
}

interface BadgeDisplayProps {
  badges: BadgeItem[];
}

// ---------------------------------------------------------------------------
// BadgeDisplay
// ---------------------------------------------------------------------------

/**
 * Renders a list of earned badges grouped by event.
 * Large badges are shown prominently; regular badges appear smaller.
 * Each badge appears at most once (enforced by DB unique constraint).
 */
export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  if (badges.length === 0) {
    return <Text c="dimmed">No badges earned yet.</Text>;
  }

  // Group by event name
  const grouped = new Map<string, BadgeItem[]>();
  for (const b of badges) {
    const key = b.eventName || 'Unknown Event';
    const existing = grouped.get(key) ?? [];
    existing.push(b);
    grouped.set(key, existing);
  }

  return (
    <Stack gap="lg">
      {[...grouped.entries()].map(([eventName, items]) => (
        <Stack key={eventName} gap="sm">
          <Text fw={600} size="sm" c="dimmed">
            {eventName}
          </Text>
          <Group gap="md" wrap="wrap">
            {items.map((item) => (
              <Tooltip
                key={`${item.awardName}-${item.issuedAt}`}
                label={`${item.awardName} • ${new Date(item.issuedAt).toLocaleDateString()}`}
                position="bottom"
              >
                <div style={{ cursor: 'default' }}>
                  <BadgeSvg
                    config={item.badgeConfig}
                    style={
                      item.badgeConfig.size === 'large'
                        ? { width: 96, height: 96 }
                        : { width: 48, height: 48 }
                    }
                  />
                </div>
              </Tooltip>
            ))}
          </Group>
        </Stack>
      ))}
    </Stack>
  );
}
