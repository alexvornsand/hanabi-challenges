import type { DB } from '../db/index.js';
import { variantRegistry } from '../db/schema.js';
import { createHLiveClient } from '../lib/hliveClient.js';
import { eq } from 'drizzle-orm';

export async function syncVariantsFromHLive(db: DB): Promise<{ inserted: number; updated: number }> {
  const client = createHLiveClient();
  const variants = await client.getAllVariants();

  let inserted = 0;
  let updated = 0;

  for (const v of variants) {
    const existing = await db
      .select()
      .from(variantRegistry)
      .where(eq(variantRegistry.variantId, v.id))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(variantRegistry).values({
        variantId: v.id,
        name: v.name,
        shortName: v.name.length > 30 ? v.name.slice(0, 27) + '...' : v.name,
        maxScore: v.maxScore,
        suitCount: v.suits,
      });
      inserted++;
    } else {
      const row = existing[0];
      if (row.name !== v.name || row.maxScore !== v.maxScore || row.suitCount !== v.suits) {
        await db
          .update(variantRegistry)
          .set({
            name: v.name,
            shortName: v.name.length > 30 ? v.name.slice(0, 27) + '...' : v.name,
            maxScore: v.maxScore,
            suitCount: v.suits,
          })
          .where(eq(variantRegistry.variantId, v.id));
        updated++;
      }
    }
  }

  return { inserted, updated };
}
