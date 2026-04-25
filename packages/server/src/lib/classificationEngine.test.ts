import { describe, it, expect } from 'vitest';
import { classifyGames } from './classificationEngine.js';
import { builtinRegistry } from '@hanabi/dsl/src/predicates/registry.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NAMES = new Map<number, string>([
  [1, 'Alice'],
  [2, 'Bob'],
  [3, 'Cathy'],
  [4, 'Dave'],
]);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('classifyGames — stable_partnership', () => {
  it('Alice + Bob always together → one team unit "team:1,2"', () => {
    const games = [
      { id: 1, participants: [1, 2] },
      { id: 2, participants: [1, 2] },
      { id: 3, participants: [1, 2] },
    ];
    const result = classifyGames(games, 'stable_partnership', NAMES, builtinRegistry);

    expect(result.units).toHaveLength(1);
    expect(result.units[0]!.unitKey).toBe('team:1,2');
    expect(result.units[0]!.type).toBe('team');
    expect(result.units[0]!.displayName).toBe('Alice & Bob');
  });

  it('Cathy (3) plays with various partners → individual unit "individual:3"', () => {
    const games = [
      { id: 1, participants: [3, 1] },
      { id: 2, participants: [3, 2] },
    ];
    const result = classifyGames(games, 'stable_partnership', NAMES, builtinRegistry);

    // stable_partnership is false when partners differ → individual
    const cathyUnit = result.units.find((u) => u.unitKey === 'individual:3');
    expect(cathyUnit).toBeDefined();
    expect(cathyUnit?.type).toBe('individual');
  });

  it('Alice+Bob play together then Bob+Cathy → all reclassified as individual', () => {
    const games = [
      { id: 1, participants: [1, 2] }, // A+B together
      { id: 2, participants: [1, 2] }, // A+B together
      { id: 3, participants: [1, 2] }, // A+B together
      { id: 4, participants: [2, 3] }, // B+C — Bob played with others → inconsistency
    ];
    const result = classifyGames(games, 'stable_partnership', NAMES, builtinRegistry);

    // Bob appears in both a "team:1,2" game AND a game with Cathy.
    // stable_partnership for game 4 would be false (Bob previously played with Alice).
    // So game 4 → individual. But Bob is in game 1-3 as team:1,2.
    // → Bob is in both team and individual → all Bob's games become individual.
    const teamUnit = result.units.find((u) => u.type === 'team' && u.memberIds.includes(2));
    expect(teamUnit).toBeUndefined();

    // Bob should be individual
    const bobUnit = result.units.find((u) => u.unitKey === 'individual:2');
    expect(bobUnit).toBeDefined();
  });

  it('classificationRule: "true" always → all participants in same team', () => {
    const games = [
      { id: 1, participants: [1, 2] },
      { id: 2, participants: [3, 4] },
    ];
    const result = classifyGames(games, '"true"', NAMES, builtinRegistry);

    // Both games evaluate to true → both are team units
    const teams = result.units.filter((u) => u.type === 'team');
    expect(teams).toHaveLength(2);
  });
});
