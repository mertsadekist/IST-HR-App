/**
 * The ranked permission ladder from the assets PRD (Statuses_Access sheet).
 *
 * The rank matters: "who holds elevated access" is a numeric question, and
 * comparing ranks beats scattering lists of magic strings through the code.
 * Admin and above is what the PRD's privileged-access reports are about.
 */
export const ACCESS_LEVELS = [
  'No Access',   // 0 — no rights
  'Viewer',      // 1 — read-only
  'User',        // 2 — basic use
  'Editor',      // 3 — can create / edit content
  'Moderator',   // 4 — can moderate platform usage
  'Analyst',     // 5 — analytics and reporting
  'Advertiser',  // 6 — can run ad activity
  'Admin',       // 7 — administrative rights
  'Super Admin', // 8 — elevated admin rights
  'Owner',       // 9 — ultimate ownership / control
];

export const accessRank = (level) => {
  const i = ACCESS_LEVELS.indexOf(level);
  return i < 0 ? 0 : i;
};

/** Admin (7) and above — the elevated-risk band the PRD reports on. */
export const PRIVILEGED_RANK = ACCESS_LEVELS.indexOf('Admin');

export const DIGITAL_STATUSES = [
  'Available', 'Pending Activation', 'Assigned', 'Active', 'Suspended', 'Revoked', 'Archived',
];

/** Statuses where the grant is no longer live, so a consumed seat comes back. */
export const RELEASED_STATUSES = ['Revoked', 'Archived'];

export const SEAT_TYPES = ['Named seat', 'Pooled seat', 'Not a seat'];
