/**
 * Clocking in from the portal, for people the door does not see (field staff,
 * remote days). Off unless an admin switches it on in Settings.
 *
 * Settings (app_settings 'portal_clock_in'):
 *   enabled           off by default
 *   who               'all' employees, or only the 'listed' ones
 *   employee_ids      the listed people
 *   require_location  refuse a punch without the browser's location
 *   sites             optional places [{ name, lat, lng, radius_m }]; when
 *                     any are set, a punch must be inside one of them
 *   max_accuracy_m    refuse a location fix vaguer than this
 *
 * Every punch is stored with where it was made. The office door stays the
 * authority: a portal punch fills a day the door has not, and never
 * overwrites a door punch.
 *
 * Pure functions here; routes/clockIn.js does the storing.
 */

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: false, who: 'all', employee_ids: [], require_location: true, sites: [], max_accuracy_m: 200,
});

/** Merge stored settings over the defaults, dropping anything malformed. */
export function normalizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    enabled: s.enabled === true,
    who: s.who === 'listed' ? 'listed' : 'all',
    employee_ids: Array.isArray(s.employee_ids) ? [...new Set(s.employee_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : [],
    require_location: s.require_location !== false,
    sites: Array.isArray(s.sites) ? s.sites.filter(validSite).map((x) => ({
      name: String(x.name).trim().slice(0, 80), lat: Number(x.lat), lng: Number(x.lng), radius_m: Math.round(Number(x.radius_m)),
    })) : [],
    max_accuracy_m: Number(s.max_accuracy_m) > 0 ? Math.min(5000, Math.round(Number(s.max_accuracy_m))) : DEFAULT_SETTINGS.max_accuracy_m,
  };
}

function validSite(x) {
  return x && String(x.name || '').trim()
    && Number(x.lat) >= -90 && Number(x.lat) <= 90 && Number(x.lng) >= -180 && Number(x.lng) <= 180
    && Number(x.radius_m) >= 20 && Number(x.radius_m) <= 50000;
}

/** Validate settings an admin saves; returns the clean object or an error. */
export function validateSettings(b = {}) {
  if (Array.isArray(b.sites) && b.sites.some((x) => !validSite(x))) {
    return { error: 'Each site needs a name, a latitude and longitude, and a radius of 20 m to 50 km' };
  }
  return { data: normalizeSettings(b) };
}

/** Great-circle distance in metres. */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/** The nearest site and whether the point is inside it. */
export function nearestSite(sites, lat, lng) {
  let best = null;
  for (const s of sites || []) {
    const d = distanceMeters(lat, lng, s.lat, s.lng);
    if (!best || d < best.distance_m) best = { site: s, distance_m: d, within: d <= s.radius_m };
  }
  return best;
}

/**
 * May this person punch now, from here?
 * @returns {{ok:true, site:object|null, distance_m:number|null}|{ok:false, reason:string}}
 */
export function checkPunch(settings, { employeeId, lat, lng, accuracy }) {
  const s = normalizeSettings(settings);
  if (!s.enabled) return { ok: false, reason: 'disabled' };
  if (s.who === 'listed' && !s.employee_ids.includes(Number(employeeId))) return { ok: false, reason: 'not_allowed' };
  const hasFix = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== null && lng !== null && lat !== '' && lng !== '';
  if (!hasFix) {
    if (s.require_location || s.sites.length) return { ok: false, reason: 'location_required' };
    return { ok: true, site: null, distance_m: null };
  }
  if (Number(accuracy) > s.max_accuracy_m) return { ok: false, reason: 'location_inaccurate' };
  if (!s.sites.length) return { ok: true, site: null, distance_m: null };
  const near = nearestSite(s.sites, Number(lat), Number(lng));
  if (!near.within) return { ok: false, reason: 'outside_sites', site: near.site, distance_m: near.distance_m };
  return { ok: true, site: near.site, distance_m: near.distance_m };
}
