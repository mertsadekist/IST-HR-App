// Idempotent migration: give published vacancies the public address they never got.
//
// A vacancy became Published by two routes. POST /:id/publish validated it and
// generated the slug; the ordinary create and update accepted `status` like any
// other field and wrote it straight through. So saving the edit form with the
// status set to Published produced a vacancy that reads Published everywhere in
// the UI and has no public URL at all — nothing to send a candidate.
//
// Three of the five published vacancies were in that state, including one HR was
// trying to share. The routes are fixed; this repairs the rows already written.
//
// The slug format matches routes/vacancies.js exactly, so a vacancy repaired here
// gets the same address it would have had if it had been published properly.
//
// Safe to re-run: only ever fills a NULL. An address somebody has already shared
// is never moved.
import pool from './config/db.js';

function slugify(s) {
  return String(s || 'job').toLowerCase().normalize('NFKD')
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
}

try {
  const [rows] = await pool.query(
    `SELECT v.id, v.title, v.work_location, v.employment_type, v.workplace_type, v.description,
            c.short_code
       FROM vacancies v LEFT JOIN companies c ON c.id = v.company_id
      WHERE v.status = 'Published' AND (v.public_slug IS NULL OR v.public_slug = '')
      ORDER BY v.id`);

  if (!rows.length) console.log('every published vacancy already has a public address');

  let fixed = 0;
  const incomplete = [];
  for (const v of rows) {
    // A vacancy missing the fields a candidate needs is not made public by this.
    // It is reported instead, because publishing an empty page is worse than
    // having no page.
    const missing = [
      !v.title && 'title', !v.work_location && 'work location',
      !v.employment_type && 'employment type', !v.workplace_type && 'workplace type',
      !v.description && 'description',
    ].filter(Boolean);
    if (missing.length) {
      incomplete.push({ id: v.id, title: v.title, missing });
      continue;
    }
    const slug = `${slugify(v.title)}-${(v.short_code || 'co').toLowerCase()}-${v.id}`;
    await pool.query(
      'UPDATE vacancies SET public_slug = ?, published_at = COALESCE(published_at, NOW()) WHERE id = ?',
      [slug, v.id]);
    console.log(`  #${v.id}  ${v.title}`);
    console.log(`        /careers/${slug}`);
    fixed++;
  }

  if (incomplete.length) {
    console.log('\nleft unpublished — a candidate could not read these yet:');
    for (const i of incomplete) console.log(`  #${i.id} ${i.title} — missing ${i.missing.join(', ')}`);
  }

  const [[c]] = await pool.query(
    `SELECT COUNT(*) total, SUM(public_slug IS NULL OR public_slug = '') without
       FROM vacancies WHERE status = 'Published'`);
  console.log(`\n${fixed} address(es) generated · ${c.total} published, ${c.without || 0} still without one`);
  console.log('BACKFILL_VACANCY_SLUGS OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
