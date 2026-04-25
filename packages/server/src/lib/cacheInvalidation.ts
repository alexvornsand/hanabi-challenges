import type { DB } from '../db/index.js';
import { speculativePrResults } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function invalidateSpeculativePR(eventId: number, db: DB): Promise<void> {
  await db.delete(speculativePrResults).where(eq(speculativePrResults.sectionId, eventId));
}
