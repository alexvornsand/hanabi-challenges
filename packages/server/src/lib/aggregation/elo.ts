import type { EloAgg } from '@hanabi/dsl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EloGame {
  /** Ordered by sequence_by — caller must sort before passing */
  unitAId: number;
  unitBId: number;
  /** 1 = A won, 0.5 = draw, 0 = B won */
  score: number;
}

export interface EloOutput {
  unitId: number;
  rating: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// computeElo
// ---------------------------------------------------------------------------

export function computeElo(
  config: EloAgg,
  games: EloGame[],
  unitIds: number[],
): EloOutput[] {
  const initialRating = config.initial_rating ?? 1500;
  const kFactor = config.k_factor ?? 32;

  // Initialise ratings
  const ratings = new Map<number, number>();
  for (const id of unitIds) {
    ratings.set(id, initialRating);
  }

  // Process games in order
  for (const { unitAId, unitBId, score } of games) {
    const rA = ratings.get(unitAId) ?? initialRating;
    const rB = ratings.get(unitBId) ?? initialRating;

    const expectedA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
    const expectedB = 1 - expectedA;

    const newA = rA + kFactor * (score - expectedA);
    const newB = rB + kFactor * ((1 - score) - expectedB);

    ratings.set(unitAId, newA);
    ratings.set(unitBId, newB);
  }

  // Sort by rating descending and assign ranks
  const rows: EloOutput[] = unitIds.map((id) => ({
    unitId: id,
    rating: ratings.get(id) ?? initialRating,
    rank: 0,
  }));

  rows.sort((a, b) => b.rating - a.rating);

  let currentRank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i]!.rating < rows[i - 1]!.rating) {
      currentRank = i + 1;
    }
    rows[i]!.rank = currentRank;
  }

  return rows;
}
