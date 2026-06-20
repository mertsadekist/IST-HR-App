/**
 * Knowledge-base content registry. Content lives in per-language modules
 * (en.js / ar.js) with identical article `id`s, kept OUT of the i18n JSON so the
 * bundle/audit stay clean and the (large) docs remain easy to maintain.
 */
import EN from './en';
import AR from './ar';

const BY_LANG = { en: EN, ar: AR };

/** All articles for the active language (falls back to English). */
export function getArticles(lang) {
  const base = (lang || 'en').split('-')[0];
  return BY_LANG[base] || EN;
}

/** A single article by id for the active language. */
export function getArticle(lang, id) {
  return getArticles(lang).find((a) => a.id === id) || null;
}

/** Map a route path to its article id (for the contextual “?” Help button). */
export function articleIdForRoute(pathname) {
  if (!pathname) return null;
  // exact match first, then prefix match (e.g. /settings/companies -> settings/* )
  const all = EN;
  const exact = all.find((a) => a.route === pathname);
  if (exact) return exact.id;
  const prefixed = all.find((a) => a.route && a.route !== '/' && pathname.startsWith(a.route));
  return prefixed ? prefixed.id : null;
}

/** Distinct group ids in display order. */
export const GROUP_ORDER = ['start', 'recruitment', 'lifecycle', 'compliance', 'analytics', 'operations', 'portal'];
