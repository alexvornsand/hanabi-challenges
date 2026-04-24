import type { DB } from '../index.js';
import { syncVariantsFromHLive } from '../../jobs/syncVariants.js';

/**
 * Seeds the variant_registry table by fetching live data from hanab.live.
 * Idempotent: uses upsert logic in syncVariantsFromHLive.
 */
export async function seedVariants(db: DB): Promise<void> {
  console.log('Fetching variants from hanab.live...');
  const { inserted, updated } = await syncVariantsFromHLive(db);
  console.log(`Variant sync complete: ${inserted} inserted, ${updated} updated.`);
}
