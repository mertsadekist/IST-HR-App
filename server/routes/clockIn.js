import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import { getAppSetting, setAppSetting } from '../services/appSettings.js';
import { resolveEffectiveSchedule, minutesOfDay } from '../services/workScheduleService.js';
import { localDate, localSecondsOfDay } from '../services/hikRules.js';
import { normalizeSettings, validateSettings, checkPunch } from '../services/clockInService.js';

// Clocking in from the portal (services/clockInService.js). Off unless an admin
// switches it on. A second source next to the office door: it fills a day the
// door has not recorded and never overwrites a door punch.
const router = Router();
router.use(auth, tenantScope);

const KEY = 'portal_clock_in';
const tz = () => process.env.TZ || 'Asia/Dubai';
const fail = (res, where, err) => { console.error(`${where} error:`, err); res.status(500).json({ error: 'Internal server error' }); };
const REASONS = {
  disabled: 'Clocking in from the portal is switched off',
  not_allowed: 'Clocking in from the portal is not enabled for you',
  location_required: 'Allow location access to clock in',
  location_inaccurate: 'Your location is not precise enough; try again outdoors or with GPS on',
  outside_sites: 'You are not at one of the allowed sites',
};

async function loadSettings() {
  const raw = await getAppSetting(KEY, null);
  try { return normalizeSettings(typeof raw === 'string' ? JSON.parse(raw) : raw); } catch { return normalizeSettings(null); }
}
async function me(req) {
  const [[u]] = await pool.query(
    `SELECT e.id, e.company_id, e.is_owner FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.id = ?`, [req.user.id]);
  return u || null;
}
/** Wall-clock now in the office time zone, as stored for door punches. */
function nowLocal() {
  const date = localDate(tz());
  const sec = localSecondsOfDay(tz());
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return { date, time: `${hh}:${mm}:${ss}`, stamp: `${date} ${hh}:${mm}:${ss}`, sec };
}

// ─── Settings (admin writes; HR reads) ───────────────────────────────────────
router.get('/settings', authorize('admin', 'hr_manager'), async (req, res) => {
  try { res.json(await loadSettings()); } catch (err) { fail(res, 'GET /clock/settings', err); }
});

router.put('/settings', authorize('admin'), async (req, res) => {
  try {
    const v = validateSettings(req.body || {});
    if (v.error) return res.status(422).json({ error: v.error });
    await setAppSetting(KEY, JSON.stringify(v.data));
    await addAudit(pool, req.user, 'Attendance', 'Portal Clock-in Settings',
      `${v.data.enabled ? 'Enabled' : 'Disabled'}; ${v.data.who === 'listed' ? `${v.data.employee_ids.length} listed people` : 'all employees'}; `
      + `location ${v.data.require_location ? 'required' : 'optional'}; ${v.data.sites.length} site(s)`);
    res.json(v.data);
  } catch (err) { fail(res, 'PUT /clock/settings', err); }
});

// ─── The employee's side ─────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const s = await loadSettings();
    const m = await me(req);
    const allowed = !!m && !m.is_owner && s.enabled && (s.who === 'all' || s.employee_ids.includes(m.id));
    if (!allowed) return res.json({ available: false });
    const { date } = nowLocal();
    const [[row]] = await pool.query(
      `SELECT TIME_FORMAT(check_in, '%H:%i') AS check_in, TIME_FORMAT(check_out, '%H:%i') AS check_out, source, status
         FROM attendance WHERE employee_id = ? AND work_date = ?`, [m.id, date]);
    const [punches] = await pool.query(
      `SELECT kind, TIME_FORMAT(punched_at, '%H:%i') AS at, site_name, within_site
         FROM portal_punches WHERE employee_id = ? AND DATE(punched_at) = ? ORDER BY punched_at`, [m.id, date]);
    res.json({
      available: true, require_location: s.require_location, sites: s.sites.map((x) => x.name),
      today: row || null, punches, next: punches.length && punches[punches.length - 1].kind === 'in' ? 'out' : 'in',
    });
  } catch (err) { fail(res, 'GET /clock/status', err); }
});

// POST /api/clock/punch { kind: 'in'|'out', lat, lng, accuracy }
router.post('/punch', async (req, res) => {
  try {
    const kind = req.body?.kind === 'out' ? 'out' : 'in';
    const m = await me(req);
    if (!m) return res.status(400).json({ error: 'No employee profile linked to your account' });
    if (m.is_owner) return res.status(409).json({ error: 'Company owners are exempt from attendance' });
    const s = await loadSettings();
    const { lat, lng, accuracy } = req.body || {};
    const check = checkPunch(s, { employeeId: m.id, lat, lng, accuracy });
    if (!check.ok) {
      return res.status(403).json({ error: REASONS[check.reason] || 'Not allowed', reason: check.reason, distance_m: check.distance_m ?? null, site: check.site?.name || null });
    }
    const now = nowLocal();
    await pool.query('INSERT INTO portal_punches SET ?', {
      company_id: m.company_id, employee_id: m.id, kind, punched_at: now.stamp,
      lat: Number.isFinite(Number(lat)) ? Number(lat) : null, lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
      accuracy_m: Number.isFinite(Number(accuracy)) ? Math.round(Number(accuracy)) : null,
      site_name: check.site?.name || null, within_site: check.site ? 1 : null, distance_m: check.distance_m,
      ip: req.ip || null, user_agent: String(req.headers['user-agent'] || '').slice(0, 250),
    });

    // The day's attendance: filled from the portal unless the door has it.
    const [[row]] = await pool.query(
      `SELECT id, source, TIME_FORMAT(check_in, '%H:%i:%s') AS ci, TIME_FORMAT(check_out, '%H:%i:%s') AS co
         FROM attendance WHERE employee_id = ? AND work_date = ?`, [m.id, now.date]);
    let recorded = false;
    if (kind === 'in') {
      if (!row || !row.ci) {
        const resolved = await resolveEffectiveSchedule(m.id, now.date).catch(() => null);
        const rule = resolved?.dayRule;
        const grace = Number(resolved?.schedule?.grace_in_minutes || 0);
        const lateBy = rule?.is_working ? Math.max(0, Math.round((now.sec - minutesOfDay(rule.start_time) * 60) / 60)) : 0;
        const late = lateBy > grace ? lateBy : 0;
        const data = {
          check_in: now.stamp, status: late ? 'Late' : 'Present', late_minutes: late || null, source: 'Self Service', punch_count: 1,
          scheduled_in: rule?.is_working ? rule.start_time : null, scheduled_out: rule?.is_working ? rule.end_time : null,
          notes: `Portal clock-in${check.site ? ` at ${check.site.name}` : ''}`,
        };
        if (row) await pool.query('UPDATE attendance SET ? WHERE id = ?', [data, row.id]);
        else await pool.query('INSERT INTO attendance SET ?', { ...data, company_id: m.company_id, employee_id: m.id, work_date: now.date, created_by: req.user.id });
        recorded = true;
      }
    } else if (row && row.ci && (row.source === 'Self Service' || !row.co) && now.time > row.ci) {
      const [h, mi, se] = row.ci.split(':').map(Number);
      const hours = Math.round(((now.sec - (h * 3600 + mi * 60 + se)) / 3600) * 100) / 100;
      await pool.query('UPDATE attendance SET check_out = ?, work_hours = ? WHERE id = ?', [now.stamp, hours, row.id]);
      recorded = true;
    }
    await addAudit(pool, req.user, 'Attendance', kind === 'in' ? 'Portal Clock In' : 'Portal Clock Out',
      `${req.user.name} clocked ${kind} from the portal${check.site ? ` at ${check.site.name}` : ''}${recorded ? '' : ' (door record kept)'}`,
      m.company_id, { type: 'employee', id: m.id });
    res.json({ success: true, kind, at: now.time.slice(0, 5), recorded, site: check.site?.name || null });
  } catch (err) { fail(res, 'POST /clock/punch', err); }
});

// ─── HR's view of portal punches ─────────────────────────────────────────────
router.get('/punches', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'p.company_id');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : localDate(tz());
    const [rows] = await pool.query(
      `SELECT p.id, p.kind, TIME_FORMAT(p.punched_at, '%H:%i') AS at, p.lat, p.lng, p.accuracy_m, p.site_name, p.within_site, p.distance_m,
              TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS employee_name
         FROM portal_punches p JOIN employees e ON e.id = p.employee_id
        WHERE DATE(p.punched_at) = ?${co.clause} ORDER BY p.punched_at DESC LIMIT 500`, [date, ...co.params]);
    res.json({ date, punches: rows.map((r) => ({ ...r, lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng) })) });
  } catch (err) { fail(res, 'GET /clock/punches', err); }
});

export default router;
