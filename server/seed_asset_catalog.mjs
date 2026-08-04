// Seeds the standard asset categories and the platform catalogue from
// data/asset_catalog_seed.json, which was generated from the company's PRD
// workbook (see docs/assets_access_module_plan.md).
//
// Written to be safe on a live database:
//   - Categories and platforms are matched by NAME, so re-running never
//     duplicates and never changes an id an existing row points at.
//   - An existing platform is only ever ENRICHED: blank fields get filled, and
//     fields the team may have edited (inventory_total, status, description,
//     category once re-pointed) are left exactly as they are.
//   - The five ad-hoc legacy categories are mapped onto canonical ones and
//     their platforms re-pointed BEFORE any delete, because
//     platform_catalog.category_id cascades — deleting a category that still
//     holds platforms would delete the platforms with it.
//   - A legacy category is dropped only once it is provably empty.
//
// Run: node seed_asset_catalog.mjs [--dry]
import fs from 'fs';
import pool from './config/db.js';

const DRY = process.argv.includes('--dry');
const seed = JSON.parse(fs.readFileSync(new URL('./data/asset_catalog_seed.json', import.meta.url)));

// Legacy category name → canonical category name.
const LEGACY_MAP = {
  'Laptop': 'Physical Assets',
  'Mobile': 'Physical Assets',
  'SIM Cards': 'Physical Assets',
  'Gmail Account': 'Identity / Access / Security',
  'Email Address': 'Identity / Access / Security',
};

const log = (...a) => console.log(DRY ? '[dry]' : '     ', ...a);
let inserted = 0, enriched = 0, untouched = 0;

try {
  if (DRY) log('DRY RUN — no writes');

  // ── 1. Canonical categories ────────────────────────────────────────────────
  const [existingCats] = await pool.query('SELECT id, name FROM asset_categories');
  const catId = new Map(existingCats.map((c) => [c.name, c.id]));

  for (const c of seed.categories) {
    const row = {
      name: c.name, icon: c.icon, examples: c.examples,
      purpose: c.purpose, recommended_owner: c.recommended_owner, sort_order: c.sort_order,
    };
    if (catId.has(c.name)) {
      if (!DRY) await pool.query('UPDATE asset_categories SET ? WHERE id = ?', [row, catId.get(c.name)]);
      log(`category kept: ${c.name}`);
    } else {
      if (!DRY) {
        const [r] = await pool.query('INSERT INTO asset_categories SET ?', row);
        catId.set(c.name, r.insertId);
      } else catId.set(c.name, -1);
      log(`category added: ${c.name}`);
    }
  }

  // ── 2. Re-point legacy categories, then retire the empty ones ──────────────
  for (const [legacy, canonical] of Object.entries(LEGACY_MAP)) {
    const from = catId.get(legacy);
    const to = catId.get(canonical);
    if (!from || from === to || !to) continue;
    const [moved] = DRY
      ? [{ affectedRows: (await pool.query('SELECT COUNT(*) c FROM platform_catalog WHERE category_id = ?', [from]))[0][0].c }]
      : await pool.query('UPDATE platform_catalog SET category_id = ? WHERE category_id = ?', [to, from]);
    log(`legacy "${legacy}" → "${canonical}": ${moved.affectedRows} platform(s) re-pointed`);

    const [[still]] = await pool.query('SELECT COUNT(*) c FROM platform_catalog WHERE category_id = ?', [from]);
    if (still.c === 0) {
      if (!DRY) await pool.query('DELETE FROM asset_categories WHERE id = ?', [from]);
      log(`legacy category "${legacy}" removed (empty)`);
    } else {
      log(`legacy category "${legacy}" KEPT — still holds ${still.c} platform(s)`);
    }
  }

  // ── 3. Companies ──────────────────────────────────────────────────────────
  // The catalogue is a SHARED LIBRARY: the categories and the classification
  // are the same structure for every company, so every platform is made
  // available to every active company. `owner_scope` still records who owns and
  // pays for each one (from the workbook) — it labels and filters, it does not
  // restrict which company may use the entry.
  const [companies] = await pool.query("SELECT id, name FROM companies WHERE status = 'Active'");
  const findCo = (needle) => companies.find((c) => c.name.toLowerCase().includes(needle))?.id || null;
  const reId = findCo('real estate'), mktId = findCo('markets');
  const allCompanyIds = companies.map((c) => c.id);
  log(`companies: ${allCompanyIds.length} active (RE=${reId} MKT=${mktId})`);
  if (!reId || !mktId) throw new Error('Could not resolve both IST Real Estate and IST Markets companies');

  // ── 4. Platforms ──────────────────────────────────────────────────────────
  const [existingPlats] = await pool.query('SELECT * FROM platform_catalog');
  const platByName = new Map(existingPlats.map((p) => [p.name.toLowerCase(), p]));

  for (const p of seed.platforms) {
    const category_id = catId.get(p.category);
    if (!category_id) { console.warn(`  ! no category for ${p.name} (${p.category}) — skipped`); continue; }
    const existing = platByName.get(p.name.toLowerCase());

    if (!existing) {
      if (!DRY) {
        const [r] = await pool.query('INSERT INTO platform_catalog SET ?', {
          category_id, name: p.name, asset_type: p.asset_type, description: p.notes,
          owner_scope: p.owner_scope, alias_of: p.alias_of,
          application_url: p.application_url, development_type: p.development_type,
          inventory_total: 0, status: 'Active',
        });
        for (const cid of allCompanyIds) {
          await pool.query('INSERT IGNORE INTO platform_companies SET ?', { platform_id: r.insertId, company_id: cid });
        }
      }
      inserted++;
      continue;
    }

    // Enrich only: fill blanks, never overwrite what the team already set.
    const patch = {};
    if (!existing.description && p.notes) patch.description = p.notes;
    if (!existing.alias_of && p.alias_of) patch.alias_of = p.alias_of;
    if (!existing.application_url && p.application_url) patch.application_url = p.application_url;
    if (!existing.development_type && p.development_type) patch.development_type = p.development_type;
    // owner_scope only when still at the GRP default and the workbook is specific.
    if (existing.owner_scope === 'GRP' && p.owner_scope !== 'GRP') patch.owner_scope = p.owner_scope;

    if (Object.keys(patch).length) {
      if (!DRY) await pool.query('UPDATE platform_catalog SET ? WHERE id = ?', [patch, existing.id]);
      log(`platform enriched: ${existing.name} (${Object.keys(patch).join(', ')})`);
      enriched++;
    } else {
      untouched++;
    }
    if (!DRY) {
      for (const cid of allCompanyIds) {
        await pool.query('INSERT IGNORE INTO platform_companies SET ?', { platform_id: existing.id, company_id: cid });
      }
    }
  }

  // ── 5. Existing rows keep working: backfill owner_scope from company ───────
  if (!DRY) {
    for (const [table] of [['asset_assignments'], ['asset_inventory']]) {
      await pool.query(`UPDATE ${table} SET owner_scope = 'RE' WHERE company_id = ? AND owner_scope = 'GRP'`, [reId]);
      await pool.query(`UPDATE ${table} SET owner_scope = 'MKT' WHERE company_id = ? AND owner_scope = 'GRP'`, [mktId]);
    }
    log('existing assignment / inventory rows scoped to their own company');
  }

  const [[cCat]] = await pool.query('SELECT COUNT(*) c FROM asset_categories');
  const [[cPlat]] = await pool.query('SELECT COUNT(*) c FROM platform_catalog');
  console.log(`\nplatforms: +${inserted} inserted, ${enriched} enriched, ${untouched} already complete`);
  console.log(`totals now: ${cCat.c} categories, ${cPlat.c} platforms`);
  console.log('SEED_ASSET_CATALOG OK');
} catch (e) {
  console.error('SEED ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
