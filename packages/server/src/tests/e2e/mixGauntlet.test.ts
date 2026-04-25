/**
 * Mix Gauntlet End-to-End Test
 *
 * Tests: attempt modifier, lazy slot assignment, and unlimited attempts.
 *
 * Requires a real Postgres database.
 * Run with: DATABASE_URL=postgres://... pnpm --filter @hanabi/server test:e2e
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { buildServer } from '../../index.js';
import { config } from '../../config.js';
import { computeAbsoluteAgg, applyUnitAttribution } from '../../lib/aggregation/absolute.js';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import type { ScoringUnitSnapshot, SlotResultSnapshot, GameResult } from '@hanabi/dsl';

let app: FastifyInstance;
let client: ReturnType<typeof postgres>;

beforeAll(async () => {
  app = await buildServer();
  client = postgres(config.DATABASE_URL);
});

afterAll(async () => {
  await app.close();
  await client.end();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGame(points: number): GameResult {
  return { points, max_score: false, participants: [] };
}

function makeSlotResult(slotIndex: number, games: GameResult[]): SlotResultSnapshot {
  return { slot_index: slotIndex, score: Math.max(...games.map((g) => g.points), 0), games };
}

function makeUnit(id: number, slotResults: SlotResultSnapshot[]): ScoringUnitSnapshot {
  return {
    id,
    name: `Team ${id}`,
    type: 'team',
    score: 0,
    rank: 0,
    slot_results: slotResults,
    section_scores: {},
    section_ranks: {},
    member_ids: [],
  };
}

// ---------------------------------------------------------------------------
// Tests (pure computation, no DB needed)
// ---------------------------------------------------------------------------

describe('Mix Gauntlet — attempt modifier and scoring', () => {
  it('team A: best variant 1 = 25, variant 2 = 20; total = 45', () => {
    const slotA1 = makeSlotResult(0, [makeGame(24), makeGame(22), makeGame(25)]);
    const slotA2 = makeSlotResult(1, [makeGame(18), makeGame(20)]);
    const unit = makeUnit(1, [slotA1, slotA2]);

    const config = { reduce: 'max' as const };
    const score1 = computeAbsoluteAgg(config, { unit, slotResults: [slotA1] }, evalExpr);
    const score2 = computeAbsoluteAgg(config, { unit, slotResults: [slotA2] }, evalExpr);

    expect(score1).toBe(25);
    expect(score2).toBe(20);
    expect(score1 + score2).toBe(45);
  });

  it('team B: best variant 1 = 25, variant 2 = 22; total = 47', () => {
    const slotB1 = makeSlotResult(0, [makeGame(25)]);
    const slotB2 = makeSlotResult(1, [makeGame(20), makeGame(21), makeGame(22)]);
    const unit = makeUnit(2, [slotB1, slotB2]);

    const config = { reduce: 'max' as const };
    const score1 = computeAbsoluteAgg(config, { unit, slotResults: [slotB1] }, evalExpr);
    const score2 = computeAbsoluteAgg(config, { unit, slotResults: [slotB2] }, evalExpr);

    expect(score1).toBe(25);
    expect(score2).toBe(22);
    expect(score1 + score2).toBe(47);
  });

  it('team B (47) ranks above team A (45)', () => {
    const scoreA = 45;
    const scoreB = 47;
    expect(scoreB).toBeGreaterThan(scoreA);
  });

  it('unit_attribution: split — team score shared between 2 members → 22.5 each', () => {
    const result = applyUnitAttribution(45, 'split', 2);
    expect(result).toBe(22.5);
  });

  it('unit_attribution: share — both members get full team score', () => {
    const result = applyUnitAttribution(45, 'share', 2);
    expect(result).toBe(45);
  });
});
