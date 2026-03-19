/**
 * Seeds the database with the Sita Smruti reference project so the app opens on
 * a case the client's team already recognises.
 *
 * Run with:  npm run seed
 */
import path from 'node:path';
import { DEFAULT_INPUTS, RATE_MASTERS } from '../src/engine/constants';
import { formatCrore } from '../src/engine/format';
import { createReport, listReports } from '../src/lib/repository';
import { getStore, newId } from '../src/lib/store';

// See scripts/ingest.ts - tsx does not load .env.local, so without this the
// seed lands in the JSON fallback rather than the configured database.
try {
  process.loadEnvFile(path.resolve(process.cwd(), '.env.local'));
} catch {
  // No .env.local - the store's own defaults apply.
}

async function main() {
  const store = await getStore();
  console.log(`Store backend: ${store.backend} (${store.detail})\n`);

  // Rate masters, so switching authority in the UI has something to load.
  for (const rm of RATE_MASTERS) {
    const existing = await store.findOne<{ _id: string }>('rate_masters', { authority: rm.authority });
    if (existing) await store.remove('rate_masters', existing._id);
    await store.insert('rate_masters', { _id: newId('rm'), ...rm });
  }
  console.log(`Seeded ${RATE_MASTERS.length} rate masters.`);

  const existing = await listReports();
  if (existing.some((r) => r.projectName === DEFAULT_INPUTS.projectName)) {
    console.log('Sita Smruti report already present - skipping.');
    process.exit(0);
  }

  // v1: the report exactly as the client produced it, at a 25% uplift.
  const atTwentyFive = await createReport({ ...DEFAULT_INPUTS, additionalCarpetToTenantsPct: 0.25 });
  console.log(`Created "${atTwentyFive.projectName}" v${atTwentyFive.version} at 25% uplift - net profit ${formatCrore(atTwentyFive.netProfit)}`);

  // v2: the same scheme at the 20% uplift the standing brief specifies.
  const atTwenty = await createReport({ ...DEFAULT_INPUTS, additionalCarpetToTenantsPct: 0.2 });
  console.log(`Created "${atTwenty.projectName}" v${atTwenty.version} at 20% uplift - net profit ${formatCrore(atTwenty.netProfit)}`);

  console.log('\nOpen http://localhost:3000/history to see both.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
