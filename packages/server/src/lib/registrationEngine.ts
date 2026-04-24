import type { DB } from '../db/index.js';
import { registrations, sections } from '../db/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Implicitly registers participants as individual scoring units for an event.
 * Called from game submission and scraping when registration_policy.implicit: true.
 * Uses ON CONFLICT DO NOTHING — safe to call multiple times.
 */
export async function implicitlyRegister(
  eventId: number,
  participants: number[],
  sectionId: number,
  db: DB,
): Promise<void> {
  if (participants.length === 0) return;

  // Fetch the section to determine dimension axis and division values
  const [section] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1);
  if (!section) return;

  const config = section.config as Record<string, unknown>;
  const dimensions = (config.dimensions as Array<{ axis: string; values: string[] }> | undefined) ?? [];

  if (dimensions.length === 0) {
    // No dimensions configured — register without dimension axis (use empty string as fallback)
    const rows = participants.map((userId) => ({
      eventId,
      unitType: 'individual' as const,
      unitId: userId,
      dimensionAxis: '',
      divisionValue: '',
      registeredBy: userId,
    }));
    await db.insert(registrations).values(rows).onConflictDoNothing();
    return;
  }

  // Register in the first dimension (primary)
  const primaryDimension = dimensions[0];
  const defaultDivision = primaryDimension.values[0] ?? '';

  const rows = participants.map((userId) => ({
    eventId,
    unitType: 'individual' as const,
    unitId: userId,
    dimensionAxis: primaryDimension.axis,
    divisionValue: defaultDivision,
    registeredBy: userId,
  }));

  await db.insert(registrations).values(rows).onConflictDoNothing();
}
