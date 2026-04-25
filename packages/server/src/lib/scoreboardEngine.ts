import type {
  Scoreboard,
  ExpandedConfig,
  ExpandedSection,
  ScoringUnitSnapshot,
  SlotResultSnapshot,
  GameResult,
  VariantInfo,
  RowStyle,
  Column,
  ScoringUnitContext,
  EventContext,
  ColourToken,
} from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';
import { computeAbsoluteAgg } from './aggregation/absolute.js';
import { computeMatchAggregate } from './aggregation/matchAggregate.js';
import type { MatchResult } from './aggregation/matchAggregate.js';
import { computeElo } from './aggregation/elo.js';
import type { EloGame } from './aggregation/elo.js';
import { computeDerivedRanking } from './aggregation/derivedRanking.js';

// ---------------------------------------------------------------------------
// Output types
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
  promotionStatus?: string | null;
  nextDivision?: string | null;
}

export interface ComputedScoreboard {
  name: string;
  featured: boolean;
  rows: ComputedRow[];
}

// ---------------------------------------------------------------------------
// Data loader types (dependency injection for testability)
// ---------------------------------------------------------------------------

export interface SlotRecord {
  id: number;
  slotIndex: number;
}

export interface GameRecord {
  id: number;
  specId: number;
  participants: number[];
  result: Record<string, unknown>;
  gameTimestamp: Date;
  source: string;
  tags: string[];
  gameResultPayload: Record<string, unknown>;
}

export interface RegistrationRecord {
  unitType: string;
  unitId: number;
  divisionValue: string;
}

export interface SpecRecord {
  id: number;
  slotId: number | null;
  slotIndex: number;
}

export interface PRRecord {
  unitType: string;
  unitId: number;
  nextDivision: string | null;
  promotionStatus: string | null;
}

export interface ScoreboardDataLoader {
  loadSlots(sectionId: number): Promise<SlotRecord[]>;
  loadSpecs(slotIds: number[]): Promise<SpecRecord[]>;
  loadGames(specIds: number[]): Promise<GameRecord[]>;
  loadRegistrations(eventId: number): Promise<RegistrationRecord[]>;
  loadPRResults(sectionId: number): Promise<PRRecord[]>;
  loadUserName(userId: number): Promise<string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findSection(config: ExpandedConfig, name: string): ExpandedSection | undefined {
  function search(s: ExpandedSection): ExpandedSection | undefined {
    if (s.name === name) return s;
    for (const child of s.sections ?? []) {
      const found = search(child);
      if (found) return found;
    }
    return undefined;
  }
  return search(config.root);
}

function gameRecordToResult(rec: GameRecord): GameResult {
  const payload = rec.gameResultPayload as {
    points?: number;
    max_score?: boolean;
    points_star?: number;
    bdr?: number;
    turn_count?: number;
    strikes?: number;
    elapsed_time?: number;
    end_condition?: string;
  };
  return {
    points: payload.points ?? 0,
    max_score: payload.max_score ?? false,
    points_star: payload.points_star,
    bdr: payload.bdr,
    turn_count: payload.turn_count,
    strikes: payload.strikes,
    elapsed_time: payload.elapsed_time,
    end_condition: payload.end_condition,
    participants: rec.participants,
    source: rec.source as 'scraped' | 'submitted',
    tags: rec.tags as string[],
    datetime_start: rec.gameTimestamp.toISOString(),
  };
}

function makeEventSnapshot(expandedConfig: ExpandedConfig) {
  return {
    slug: expandedConfig.root.slug ?? '',
    name: expandedConfig.root.name,
    status: 'published' as const,
    sections: {},
  };
}

function evalBool(
  expr: string,
  ctx: Parameters<typeof evalExpr>[1],
): boolean {
  const parsed = parseExpr(expr);
  if (!parsed.ok) return false;
  const result = evalExpr(parsed.node, ctx);
  return result.ok ? Boolean(result.value) : false;
}

function evalValue(
  expr: string,
  ctx: Parameters<typeof evalExpr>[1],
): unknown {
  const parsed = parseExpr(expr);
  if (!parsed.ok) return null;
  const result = evalExpr(parsed.node, ctx);
  return result.ok ? result.value : null;
}

// ---------------------------------------------------------------------------
// Core: buildUnitSnapshots
// ---------------------------------------------------------------------------

function buildUnitSnapshotsFromRegistrations(
  registrations: RegistrationRecord[],
): ScoringUnitSnapshot[] {
  return registrations.map((reg) => ({
    id: reg.unitId,
    name: `unit:${reg.unitId}`,
    type: reg.unitType as 'individual' | 'team',
    score: 0,
    rank: 0,
    slot_results: [],
    section_scores: {},
    section_ranks: {},
    member_ids: [],
  }));
}

// ---------------------------------------------------------------------------
// Core: buildSlotResults
// ---------------------------------------------------------------------------

function buildSlotResults(
  unit: ScoringUnitSnapshot,
  slots: SlotRecord[],
  specs: SpecRecord[],
  games: GameRecord[],
): SlotResultSnapshot[] {
  const gamesBySpec = new Map<number, GameRecord[]>();
  for (const g of games) {
    const arr = gamesBySpec.get(g.specId) ?? [];
    arr.push(g);
    gamesBySpec.set(g.specId, arr);
  }

  return slots.map((slot) => {
    const slotSpecs = specs.filter((s) => s.slotId === slot.id);
    const slotGames: GameResult[] = [];
    let slotScore = 0;

    for (const spec of slotSpecs) {
      const specGames = (gamesBySpec.get(spec.id) ?? []).filter(
        (g) => g.participants.includes(unit.id),
      );
      for (const g of specGames) {
        const gr = gameRecordToResult(g);
        slotGames.push(gr);
        slotScore = Math.max(slotScore, gr.points);
      }
    }

    return { slot_index: slot.slotIndex, score: slotScore, games: slotGames };
  });
}

// ---------------------------------------------------------------------------
// Core: computeScore
// ---------------------------------------------------------------------------

function computeUnitScore(
  unit: ScoringUnitSnapshot,
  section: ExpandedSection,
): number {
  if (!section.aggregation_function) {
    // Default: sum all slot scores
    return unit.slot_results.reduce((sum, sr) => sum + sr.score, 0);
  }

  const agg = section.aggregation_function;
  if ('fn' in agg) {
    if (agg.fn === 'match_aggregate' || agg.fn === 'elo' || agg.fn === 'derived_ranking') {
      // These are computed in batch — individual score is not meaningful here
      return 0;
    }
  }

  // AbsoluteAgg
  return computeAbsoluteAgg(
    agg as Parameters<typeof computeAbsoluteAgg>[0],
    { unit, slotResults: unit.slot_results },
    evalExpr,
  );
}

// ---------------------------------------------------------------------------
// Core: computeColumns
// ---------------------------------------------------------------------------

function computeColumns(
  columns: Column[],
  unit: ScoringUnitSnapshot,
  eventSnapshot: ReturnType<typeof makeEventSnapshot>,
): ComputedColumn[] {
  const result: ComputedColumn[] = [];

  for (const col of columns) {
    if (col.visible !== undefined) {
      const visible = evalBool(col.visible, { event: eventSnapshot } as unknown as Parameters<typeof evalExpr>[1]);
      if (!visible) continue;
    }

    if (col.for_each) {
      // for_each — evaluate the list expression, create one column per element
      const listVal = evalValue(col.for_each, {
        unit,
        event: eventSnapshot,
        section: { name: '', status: 'draft', time_window: {}, results: [] },
      } as unknown as Parameters<typeof evalExpr>[1]);

      if (Array.isArray(listVal)) {
        for (const item of listVal) {
          const itemCtx = {
            unit,
            event: eventSnapshot,
            $item: item,
            section: { name: '', status: 'draft', time_window: {}, results: [] },
          } as unknown as Parameters<typeof evalExpr>[1];
          const val = evalValue(col.value, itemCtx);
          result.push({ label: col.label, value: val });
        }
      }
    } else {
      const ctx = {
        unit,
        event: eventSnapshot,
        section: { name: '', status: 'draft', time_window: {}, results: [] },
      } as unknown as Parameters<typeof evalExpr>[1];
      const val = evalValue(col.value, ctx);
      result.push({ label: col.label, value: val });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Core: applyRowStyles
// ---------------------------------------------------------------------------

function applyRowStyle(
  rowStyles: RowStyle[],
  unit: ScoringUnitSnapshot,
  eventSnapshot: ReturnType<typeof makeEventSnapshot>,
): { accent: ColourToken; label?: string } | null {
  if (!rowStyles.length) return null;

  // Sort by priority descending (higher priority wins)
  const sorted = [...rowStyles].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const unitCtx: ScoringUnitContext = {
    unit,
    section: { name: '', status: 'draft', time_window: {}, results: [] },
    event: eventSnapshot,
  };

  for (const style of sorted) {
    const predExpr = style.when ?? style.predicate;
    if (!predExpr) continue;
    const matches = evalBool(predExpr, unitCtx as unknown as Parameters<typeof evalExpr>[1]);
    if (matches) {
      return { accent: style.accent, label: style.label };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core: rankRows (apply rank_by sorting)
// ---------------------------------------------------------------------------

function rankRows(
  rows: ComputedRow[],
  scoreboard: Scoreboard,
  eventSnapshot: ReturnType<typeof makeEventSnapshot>,
  unitMap: Map<number, ScoringUnitSnapshot>,
): ComputedRow[] {
  const rankBy = scoreboard.rank_by;
  if (!rankBy) return rows;

  const primary = rankBy.primary;
  const tiebreakers = rankBy.tiebreakers ?? [];

  function evalRankExpr(expr: string, unit: ScoringUnitSnapshot): number {
    const parsed = parseExpr(expr);
    if (!parsed.ok) return 0;
    const ctx = {
      unit,
      event: eventSnapshot,
      section: { name: '', status: 'draft', time_window: {}, results: [] },
    } as unknown as Parameters<typeof evalExpr>[1];
    const result = evalExpr(parsed.node, ctx);
    if (!result.ok) return 0;
    const v = result.value;
    return typeof v === 'number' ? v : 0;
  }

  const sorted = [...rows].sort((a, b) => {
    const ua = unitMap.get(a.unitId);
    const ub = unitMap.get(b.unitId);
    if (!ua || !ub) return 0;

    const va = evalRankExpr(primary.expr, ua);
    const vb = evalRankExpr(primary.expr, ub);
    const cmp = primary.direction === 'ascending' ? va - vb : vb - va;
    if (cmp !== 0) return cmp;

    for (const tb of tiebreakers) {
      const tva = evalRankExpr(tb.expr, ua);
      const tvb = evalRankExpr(tb.expr, ub);
      const tcmp = tb.direction === 'ascending' ? tva - tvb : tvb - tva;
      if (tcmp !== 0) return tcmp;
    }
    return 0;
  });

  // Assign display ranks (with ties)
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const ua = unitMap.get(sorted[i]!.unitId);
      const ub = unitMap.get(sorted[i - 1]!.unitId);
      if (ua && ub) {
        const va = evalRankExpr(primary.expr, ua);
        const vb = evalRankExpr(primary.expr, ub);
        if (va !== vb) currentRank = i + 1;
      }
    }
    sorted[i]!.displayRank = currentRank;
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// computeScoreboard (pure — accepts pre-loaded data for testability)
// ---------------------------------------------------------------------------

export interface ScoreboardInputData {
  units: ScoringUnitSnapshot[];
  prResults?: PRRecord[];
}

export function computeScoreboardFromData(
  scoreboard: Scoreboard,
  expandedConfig: ExpandedConfig,
  data: ScoreboardInputData,
): ComputedScoreboard {
  const { units, prResults = [] } = data;
  const eventSnapshot = makeEventSnapshot(expandedConfig);
  const section = findSection(expandedConfig, scoreboard.scope) ?? expandedConfig.root;

  // 1. Filter units
  let filteredUnits = units;
  if (scoreboard.filter) {
    const filterExpr = scoreboard.filter;
    filteredUnits = units.filter((unit) => {
      const ctx = {
        unit,
        event: eventSnapshot,
        section: { name: section.name, status: 'draft', time_window: {}, results: [] },
      } as unknown as Parameters<typeof evalExpr>[1];
      return evalBool(filterExpr, ctx);
    });
  }

  // 2. Evaluate featured
  let featured = true;
  if (scoreboard.featured !== undefined) {
    const ctx: EventContext = { event: eventSnapshot };
    featured = evalBool(scoreboard.featured, ctx as unknown as Parameters<typeof evalExpr>[1]);
  }

  // 3. Build unit map
  const unitMap = new Map<number, ScoringUnitSnapshot>();
  for (const u of filteredUnits) unitMap.set(u.id, u);

  // 4. Build PR map
  const prMap = new Map<number, PRRecord>();
  for (const pr of prResults) prMap.set(pr.unitId, pr);

  // 5. Build rows
  const rowStyles = section.scoreboards?.flatMap((sb) => sb.row_styles ?? []) ?? [];
  const scoreboardRowStyles = scoreboard.row_styles ?? rowStyles;

  const rows: ComputedRow[] = filteredUnits.map((unit) => {
    const columns = computeColumns(scoreboard.columns ?? [], unit, eventSnapshot);
    const style = applyRowStyle(scoreboardRowStyles, unit, eventSnapshot);
    const pr = prMap.get(unit.id);

    return {
      unitId: unit.id,
      unitName: unit.name,
      score: unit.score,
      displayRank: unit.rank,
      columns,
      rowStyle: style,
      promotionStatus: pr?.promotionStatus ?? null,
      nextDivision: pr?.nextDivision ?? null,
    };
  });

  // 6. Apply rank_by
  const rankedRows = rankRows(rows, scoreboard, eventSnapshot, unitMap);

  return { name: scoreboard.name, featured, rows: rankedRows };
}

// ---------------------------------------------------------------------------
// computeScoreboard (async — loads data from DB)
// ---------------------------------------------------------------------------

export async function computeScoreboard(
  scoreboard: Scoreboard,
  expandedConfig: ExpandedConfig,
  loader: ScoreboardDataLoader,
  variants: Map<number, VariantInfo>,
  eventId: number,
): Promise<ComputedScoreboard> {
  const section = findSection(expandedConfig, scoreboard.scope) ?? expandedConfig.root;

  // Load slots for section
  // We need to find the section ID from the DB — here we use expandedConfig.root as a proxy
  // In production, sectionId is passed or derived from eventId + section name
  const sectionId = eventId; // simplified: root event = section 0; full impl needs section lookup

  const [slots, registrations, prResults] = await Promise.all([
    loader.loadSlots(sectionId),
    loader.loadRegistrations(eventId),
    loader.loadPRResults(sectionId),
  ]);

  const slotIds = slots.map((s) => s.id);
  const specs = await loader.loadSpecs(slotIds);
  const specIds = specs.map((s) => s.id);
  const games = await loader.loadGames(specIds);

  // Build units from registrations
  const unitSnapshots = buildUnitSnapshotsFromRegistrations(registrations);

  // Attach slot results to each unit
  for (const unit of unitSnapshots) {
    unit.slot_results = buildSlotResults(unit, slots, specs, games);
    // Compute score via absolute agg (or default sum)
    unit.score = computeUnitScore(unit, section);
  }

  return computeScoreboardFromData(scoreboard, expandedConfig, { units: unitSnapshots, prResults });
}
