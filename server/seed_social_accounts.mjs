// Seeds the 26 social account shells from data/social_accounts_seed.json —
// 13 platforms for IST Real Estate and the same 13 for IST Markets, as the PRD
// workbook lists them, each pre-filled with its account type, the business
// manager that owns it and the ads platform that spends on it.
//
// The accounts start at status 'To Be Completed', which is the workbook's own
// value and the honest one: the record exists, the ownership details do not yet.
//
// DELIBERATELY NOT SEEDED: the workbook's 78 team-access rows. In a spreadsheet
// an empty row is a visual template; in a database it is a grant that belongs to
// nobody, and it would pollute every count and report the PRD asks for. The
// three-layer structure comes from the layer vocabulary instead, and an access
// row is created when a real person is actually given access.
//
// Matched on (company, entity, platform) by the table's unique key, so re-running
// never duplicates and never overwrites details the team has filled in.
//
// Run: node seed_social_accounts.mjs [--dry]
import fs from 'fs';
import pool from './config/db.js';

const DRY = process.argv.includes('--dry');
const seed = JSON.parse(fs.readFileSync(new URL('./data/social_accounts_seed.json', import.meta.url)));
const ENTITY_SCOPE = { 'IST Real Estate': 'RE', 'IST Markets': 'MKT' };

try {
  const [companies] = await pool.query("SELECT id, name FROM companies WHERE status = 'Active'");
  const findCo = (needle) => companies.find((c) => c.name.toLowerCase().includes(needle))?.id || null;
  const companyFor = { RE: findCo('real estate'), MKT: findCo('markets') };
  if (!companyFor.RE || !companyFor.MKT) {
    throw new Error('Could not resolve both IST Real Estate and IST Markets companies');
  }
  console.log(`companies: RE=${companyFor.RE} MKT=${companyFor.MKT}`);

  let inserted = 0, enriched = 0, untouched = 0;
  for (const a of seed.accounts) {
    const scope = ENTITY_SCOPE[a.entity];
    if (!scope) { console.warn(`  ! unknown entity "${a.entity}" — skipped`); continue; }
    const companyId = companyFor[scope];

    const [[existing]] = await pool.query(
      'SELECT id, account_type, business_manager_name, ads_manager_platform FROM social_accounts WHERE company_id = ? AND owner_scope = ? AND platform = ?',
      [companyId, scope, a.platform]);

    if (!existing) {
      if (!DRY) {
        await pool.query('INSERT INTO social_accounts SET ?', {
          company_id: companyId, owner_scope: scope, platform: a.platform,
          account_type: a.account_type, business_manager_name: a.business_manager_name,
          ads_manager_platform: a.ads_manager_platform, status: 'To Be Completed',
        });
      }
      inserted++;
      continue;
    }

    // Fill blanks only — never overwrite what the team has entered.
    const patch = {};
    if (!existing.account_type && a.account_type) patch.account_type = a.account_type;
    if (!existing.business_manager_name && a.business_manager_name) patch.business_manager_name = a.business_manager_name;
    if (!existing.ads_manager_platform && a.ads_manager_platform) patch.ads_manager_platform = a.ads_manager_platform;
    if (Object.keys(patch).length) {
      if (!DRY) await pool.query('UPDATE social_accounts SET ? WHERE id = ?', [patch, existing.id]);
      console.log(`  enriched ${scope} ${a.platform}: ${Object.keys(patch).join(', ')}`);
      enriched++;
    } else {
      untouched++;
    }
  }

  const [byScope] = await pool.query(
    'SELECT owner_scope, COUNT(*) n FROM social_accounts GROUP BY owner_scope');
  console.log(`\naccounts: +${inserted} inserted, ${enriched} enriched, ${untouched} already complete`);
  console.log('per entity:', byScope.map((r) => `${r.owner_scope}=${r.n}`).join(' '));
  console.log(`asset layers available: ${seed.asset_layers.length} (access rows are created per person, not seeded)`);
  console.log('SEED_SOCIAL_ACCOUNTS OK');
} catch (e) {
  console.error('SEED ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
