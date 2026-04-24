import { db } from '../index.js';
import { colourTokenRegistry } from '../schema.js';
import { COLOUR_TOKENS } from './colourTokens.js';

async function seed() {
  console.log('Seeding colour tokens...');
  await db
    .insert(colourTokenRegistry)
    .values(
      COLOUR_TOKENS.map((t) => ({
        token: t.token,
        system: t.system,
        lightHex: t.lightHex,
        darkHex: t.darkHex,
      })),
    )
    .onConflictDoNothing();
  console.log(`Inserted ${COLOUR_TOKENS.length} colour tokens (idempotent).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
