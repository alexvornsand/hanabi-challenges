import type { ExpandedConfig, ExpandedSection, ScoringUnitContext, EventSnapshot } from '@hanabi/dsl';
import { evalYamlControlFlow } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import type { DB } from '../db/index.js';
import {
  awardIssuances,
  awards as awardsTable,
  registrations,
  teamMembers,
  sections,
} from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEventSnapshot(expandedConfig: ExpandedConfig, status: 'draft' | 'published' | 'closed'): EventSnapshot {
  return {
    slug: expandedConfig.root.slug ?? '',
    name: expandedConfig.root.name,
    status,
    sections: {},
  };
}

function collectSections(section: ExpandedSection): ExpandedSection[] {
  return [section, ...section.sections.flatMap(collectSections)];
}

// ---------------------------------------------------------------------------
// processAwards
// ---------------------------------------------------------------------------

export async function processAwards(
  expandedConfig: ExpandedConfig,
  eventId: number,
  db: DB,
): Promise<number> {
  let issued = 0;

  // Load event status
  const eventRow = await db
    .select({ status: sections.status })
    .from(sections)
    .where(eq(sections.id, eventId))
    .limit(1);

  const eventStatus = (eventRow[0]?.status ?? 'published') as 'draft' | 'published' | 'closed';
  const eventSnapshot = makeEventSnapshot(expandedConfig, eventStatus);

  // Load award configs from DB (keyed by name)
  const dbAwards = await db
    .select()
    .from(awardsTable)
    .where(eq(awardsTable.sectionId, eventId))
    .limit(10000);

  // Load registrations to know who to evaluate
  const allRegistrations = await db
    .select()
    .from(registrations)
    .where(eq(registrations.eventId, eventId))
    .limit(10000);

  // Build unit snapshots (minimal — real scores would come from scoreboardEngine)
  const teamIds = allRegistrations.filter((r) => r.unitType === 'team').map((r) => r.unitId);
  const teamMemberRows = teamIds.length > 0
    ? await db
        .select()
        .from(teamMembers)
        .where(and(inArray(teamMembers.teamId, teamIds)))
        .limit(10000)
    : [];

  const teamMembersMap = new Map<number, number[]>();
  for (const row of teamMemberRows) {
    if (!row.leftAt) {
      const existing = teamMembersMap.get(row.teamId) ?? [];
      existing.push(row.userId);
      teamMembersMap.set(row.teamId, existing);
    }
  }

  // Process each section's awards
  const allSections = collectSections(expandedConfig.root);

  for (const section of allSections) {
    for (const award of section.awards) {
      // Find matching DB award by name
      const dbAward = dbAwards.find((a) => a.awardName === award.name);
      if (!dbAward) continue;

      // 1. Evaluate `when` expression in event context
      if (award.when) {
        const eventCtx = { event: eventSnapshot };
        const whenResult = evalYamlControlFlow(award.when, eventCtx as Parameters<typeof evalYamlControlFlow>[1]);
        if (!whenResult.ok || !whenResult.value) continue;
      }

      // 2. Evaluate predicate for each unit
      for (const reg of allRegistrations) {
        // Build minimal unit context
        const unitSnapshot = {
          id: reg.unitId,
          name: `unit:${reg.unitId}`,
          type: reg.unitType as 'individual' | 'team',
          score: 0,
          rank: 0,
          slot_results: [],
          section_scores: {},
          section_ranks: {},
          member_ids: reg.unitType === 'team' ? (teamMembersMap.get(reg.unitId) ?? []) : [reg.unitId],
        };

        const unitCtx: ScoringUnitContext = {
          unit: unitSnapshot,
          section: {
            name: section.name,
            status: eventStatus,
            time_window: {},
            results: [],
          },
          event: eventSnapshot,
        };

        const predResult = evalYamlControlFlow(
          award.predicate as string | object,
          unitCtx as Parameters<typeof evalYamlControlFlow>[1],
        );

        if (!predResult.ok || !predResult.value) continue;

        // 3. Determine player IDs to issue badge to
        const playerIds: number[] = reg.unitType === 'team'
          ? (teamMembersMap.get(reg.unitId) ?? [])
          : [reg.unitId];

        // 4. Insert award_issuances (idempotent)
        for (const userId of playerIds) {
          try {
            await db
              .insert(awardIssuances)
              .values({ awardId: dbAward.id, userId, issuedAt: new Date() })
              .onConflictDoNothing();
            issued++;
          } catch {
            // Conflict — already issued, ignore
          }
        }
      }
    }
  }

  return issued;
}
