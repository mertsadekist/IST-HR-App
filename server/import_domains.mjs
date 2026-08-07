// One-off import of the registrar domain export into domain_assets.
//
// Source: the registrar CSV (Domain Name, Create/Expiration Date, Auto-renew,
// Status, Hosting Name, Registrant / Administrative / Billing contacts), mapped
// to the shape the user filled in by hand for eshopnaf.com — which is the
// worked example this follows.
//
// Rules applied, all visible so they can be corrected:
//   renewal_date      <- Expiration Date (the CSV is DD/MM/YYYY)
//   account_owner     <- Registrant name
//   technical_owner   <- Administrative name, falling back to the registrant
//   billing_owner     <- Billing name, falling back to the registrant
//   assigned_employee <- the matching employee, only when the registrant is a
//                        person; an organisation registrant is left unassigned
//   entity            <- istmarkets* to IST Markets, istrealestate* to IST Real
//                        Estate, everything else shared under IST Real Estate
//                        (which is what the eshopnaf example used)
//   notes             <- "Create Date : ..." plus billing contact and any
//                        non-standard registrar status, so nothing in the CSV
//                        is silently dropped
//
// Matched on domain name, so re-running never duplicates. An existing row is
// only ENRICHED — blank fields are filled and nothing already entered is
// overwritten, because eshopnaf.com was typed in by hand.
//
// Run: node import_domains.mjs [--dry]
import fs from 'fs';
import pool from './config/db.js';

const DRY = process.argv.includes('--dry');
const CSV = process.argv.find((a) => a.endsWith('.csv'))
  || 'C:/Users/MertSadek/Downloads/1domainexport_20260807_221pm.csv';

// "19/12/2027" -> "2027-12-19"; blank stays blank.
const isoDate = (v) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const clean = (v) => { const s = String(v ?? '').trim(); return s === '' ? null : s; };
const fullName = (first, last) => [clean(first), clean(last)].filter(Boolean).join(' ') || null;

// The registrar spells these slightly differently from the catalogue.
const REGISTRAR_ALIAS = { godaddy: 'GoDaddy', cloudflare: 'Cloudflare', onlydomains: 'OnlyDomains' };
// Registrant values that are the company itself rather than a person.
const ORG_REGISTRANTS = [/^ist\s/i, /limited$/i, /\bltd\b/i, /\bllc\b/i];

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
}

try {
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  console.log(`${rows.length} row(s) in ${CSV.split(/[\\/]/).pop()}${DRY ? '  [DRY RUN]' : ''}\n`);

  const [companies] = await pool.query("SELECT id, name FROM companies WHERE status = 'Active'");
  const findCo = (needle) => companies.find((c) => c.name.toLowerCase().includes(needle))?.id;
  const RE_ID = findCo('real estate'), MKT_ID = findCo('markets');
  if (!RE_ID || !MKT_ID) throw new Error('Could not resolve both companies');

  const [plats] = await pool.query(
    `SELECT pc.id, pc.name FROM platform_catalog pc
      JOIN asset_categories ac ON pc.category_id = ac.id
     WHERE ac.name = 'Domains / Hosting / Infrastructure'`);
  const platformByName = new Map(plats.map((p) => [p.name.toLowerCase(), p.id]));

  const [emps] = await pool.query(
    "SELECT id, TRIM(CONCAT(first_name,' ',last_name)) nm FROM employees WHERE status IN ('Active','Onboarding')");
  const employeeByName = new Map(emps.map((e) => [e.nm.replace(/\s+/g, ' ').toLowerCase(), e.id]));

  let inserted = 0, enriched = 0, untouched = 0;
  const report = [];

  for (const r of rows) {
    const domain = clean(r['Domain Name']);
    if (!domain) continue;

    const registrarRaw = clean(r['Hosting Name']) || '';
    const registrar = REGISTRAR_ALIAS[registrarRaw.toLowerCase()] || registrarRaw || null;
    const platformId = registrar ? platformByName.get(registrar.toLowerCase()) || null : null;

    const registrant = fullName(r['Registrant First Name'], r['Registrant Last Name']);
    const admin = fullName(r['Administrative First Name'], r['Administrative Last Name']);
    const billing = fullName(r['Billing First Name'], r['Billing Last Name']);
    const isOrg = registrant ? ORG_REGISTRANTS.some((re) => re.test(registrant)) : true;

    const lower = domain.toLowerCase();
    const isMarkets = lower.startsWith('istmarkets');
    const isRealEstate = lower.startsWith('istrealestate');
    const companyId = isMarkets ? MKT_ID : RE_ID;
    const ownerScope = isMarkets ? 'MKT' : isRealEstate ? 'RE' : 'GRP';

    const rawStatus = clean(r.Status) || 'Active';
    // Anything the registrar reports that is not a plain Active is held rather
    // than assumed fine — the raw wording goes into the notes.
    const status = rawStatus.toLowerCase() === 'active' ? 'Active' : 'Pending';

    const noteParts = [];
    if (clean(r['Create Date'])) noteParts.push(`Create Date : ${clean(r['Create Date'])}`);
    if (clean(r['Ownership Date']) && clean(r['Ownership Date']) !== clean(r['Create Date'])) {
      noteParts.push(`Ownership Date : ${clean(r['Ownership Date'])}`);
    }
    if (status !== 'Active') noteParts.push(`Registrar status : ${rawStatus}`);
    const billingContact = [clean(r['Billing Email']), clean(r['Billing Phone'])].filter(Boolean).join(' · ');
    if (billingContact) noteParts.push(`Billing contact : ${billingContact}`);
    if (isOrg && registrant) noteParts.push(`Registrant on record : ${registrant}`);

    const data = {
      company_id: companyId,
      owner_scope: ownerScope,
      platform_id: platformId,
      account_or_domain_name: domain,
      domain_name: domain,
      registrar_provider: registrar,
      asset_kind: 'Domain',
      account_owner: registrant,
      technical_owner: admin || registrant,
      billing_owner: billing || registrant,
      assigned_employee_id: isOrg ? null : employeeByName.get((registrant || '').toLowerCase()) || null,
      renewal_date: isoDate(r['Expiration Date']),
      auto_renew: String(r['Auto-renew'] || '').trim().toLowerCase() === 'on',
      account_status: status,
      notes: noteParts.join('\n') || null,
    };

    const [[existing]] = await pool.query(
      'SELECT * FROM domain_assets WHERE domain_name = ? OR account_or_domain_name = ? LIMIT 1', [domain, domain]);

    if (!existing) {
      if (!DRY) await pool.query('INSERT INTO domain_assets SET ?', data);
      inserted++;
      report.push(`  + ${domain.padEnd(24)} ${ownerScope}  ${(registrar || '—').padEnd(12)} renews ${data.renewal_date}${status !== 'Active' ? `  [${rawStatus}]` : ''}`);
      continue;
    }

    // Enrich only: never overwrite what was entered by hand.
    const patch = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === 'company_id' || v == null || v === false) continue;
      if (existing[k] === null || existing[k] === '' || existing[k] === undefined) patch[k] = v;
    }
    if (Object.keys(patch).length) {
      if (!DRY) await pool.query('UPDATE domain_assets SET ? WHERE id = ?', [patch, existing.id]);
      enriched++;
      report.push(`  ~ ${domain.padEnd(24)} filled: ${Object.keys(patch).join(', ')}`);
    } else {
      untouched++;
      report.push(`  = ${domain.padEnd(24)} already complete`);
    }
  }

  console.log(report.join('\n'));
  console.log(`\n+${inserted} inserted, ${enriched} enriched, ${untouched} already complete`);

  const [[t]] = await pool.query('SELECT COUNT(*) n FROM domain_assets');
  const [byScope] = await pool.query('SELECT owner_scope, COUNT(*) n FROM domain_assets GROUP BY owner_scope');
  console.log(`domain_assets now holds ${t.n} record(s) — ${byScope.map((x) => `${x.owner_scope}:${x.n}`).join(' ')}`);
  console.log('IMPORT_DOMAINS OK');
} catch (e) {
  console.error('IMPORT ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
