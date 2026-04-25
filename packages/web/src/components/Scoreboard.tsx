import React, { useState } from 'react';
import { Table, Text, Tooltip, useMantineColorScheme } from '@mantine/core';
import type { ColourToken } from '@hanabi/dsl';
import { COLOUR_HEX } from '../lib/colourTokens';

// ---------------------------------------------------------------------------
// Types (mirrors ComputedScoreboard from scoreboardEngine)
// ---------------------------------------------------------------------------

export interface ComputedColumn {
  label: string;
  value: unknown;
}

export interface ComputedRow {
  unitId: number;
  unitName: string;
  score: number;
  displayRank: number;
  columns: ComputedColumn[];
  rowStyle?: { accent: ColourToken; label?: string } | null;
  isSpeculative?: boolean;
  promotionStatus?: string | null;
  nextDivision?: string | null;
}

export interface ComputedScoreboard {
  name: string;
  featured: boolean;
  rows: ComputedRow[];
}

// ---------------------------------------------------------------------------
// Sort state
// ---------------------------------------------------------------------------

type SortDir = 'asc' | 'desc' | null;

interface SortState {
  columnLabel: string;
  dir: SortDir;
}

function nextDir(current: SortDir): SortDir {
  if (current === null) return 'asc';
  if (current === 'asc') return 'desc';
  return null;
}

function sortArrow(dir: SortDir): string {
  if (dir === 'asc') return ' ▲';
  if (dir === 'desc') return ' ▼';
  return '';
}

// ---------------------------------------------------------------------------
// Row sorting
// ---------------------------------------------------------------------------

function sortedRows(rows: ComputedRow[], sort: SortState | null): ComputedRow[] {
  if (!sort || sort.dir === null) return rows;
  const { columnLabel, dir } = sort;
  return [...rows].sort((a, b) => {
    const aCol = a.columns.find((c) => c.label === columnLabel);
    const bCol = b.columns.find((c) => c.label === columnLabel);
    const av = aCol?.value ?? 0;
    const bv = bCol?.value ?? 0;
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Speculative P/R indicator
// ---------------------------------------------------------------------------

function SpeculativeIndicator({ status, nextDivision }: { status: string; nextDivision?: string | null }) {
  const isPromoted = status === 'promoted';
  const arrow = isPromoted ? '↑' : '↓';
  const colour = isPromoted ? COLOUR_HEX['pos-2'].light : COLOUR_HEX['neg-2'].light;
  const label = `Projected: ${nextDivision ?? status} (current standings)`;
  return (
    <Tooltip label={label}>
      <Text component="span" style={{ color: colour, marginLeft: 4, fontWeight: 700 }}>
        {arrow}
      </Text>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Scoreboard component
// ---------------------------------------------------------------------------

interface ScoreboardProps {
  scoreboard: ComputedScoreboard;
  /** Column labels that are sortable. Defaults to all columns with numeric values. */
  sortableColumns?: string[];
}

export function Scoreboard({ scoreboard, sortableColumns }: ScoreboardProps) {
  const { colorScheme } = useMantineColorScheme();
  const [sort, setSort] = useState<SortState | null>(null);

  if (scoreboard.rows.length === 0) {
    return <Text c="dimmed">No results yet.</Text>;
  }

  const columnHeaders = scoreboard.rows[0]?.columns.map((c) => c.label) ?? [];
  const rows = sortedRows(scoreboard.rows, sort);

  function handleColumnClick(label: string) {
    if (sort?.columnLabel === label) {
      const next = nextDir(sort.dir);
      setSort(next === null ? null : { columnLabel: label, dir: next });
    } else {
      setSort({ columnLabel: label, dir: 'asc' });
    }
  }

  function isSortable(label: string): boolean {
    if (sortableColumns) return sortableColumns.includes(label);
    // Default: treat numeric-valued columns as sortable
    return scoreboard.rows.some((r) => {
      const col = r.columns.find((c) => c.label === label);
      return typeof col?.value === 'number';
    });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Rank</Table.Th>
            <Table.Th>Name</Table.Th>
            {columnHeaders.map((label) => (
              <Table.Th
                key={label}
                onClick={isSortable(label) ? () => handleColumnClick(label) : undefined}
                style={isSortable(label) ? { cursor: 'pointer', userSelect: 'none' } : undefined}
              >
                {label}
                {sort?.columnLabel === label ? sortArrow(sort.dir) : ''}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => {
            const ribbonColour = row.rowStyle
              ? (colorScheme === 'dark'
                  ? COLOUR_HEX[row.rowStyle.accent]?.dark
                  : COLOUR_HEX[row.rowStyle.accent]?.light) ?? undefined
              : undefined;

            return (
              <Table.Tr
                key={row.unitId}
                title={row.rowStyle?.label}
                aria-label={row.rowStyle?.label}
                style={ribbonColour ? { borderLeft: `8px solid ${ribbonColour}` } : undefined}
              >
                <Table.Td>{row.displayRank}</Table.Td>
                <Table.Td>
                  {row.unitName}
                  {row.isSpeculative && row.promotionStatus && (
                    <SpeculativeIndicator
                      status={row.promotionStatus}
                      nextDivision={row.nextDivision}
                    />
                  )}
                </Table.Td>
                {row.columns.map((col) => (
                  <Table.Td key={col.label}>
                    {col.value == null ? '—' : String(col.value)}
                  </Table.Td>
                ))}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </div>
  );
}
