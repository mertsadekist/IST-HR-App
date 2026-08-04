/**
 * Social-media governance vocabularies from the assets PRD.
 *
 * The three asset layers are the heart of the model (governance rule 6):
 * permissions differ per layer, so a person's rights on the public page, on the
 * business manager that owns it, and on the ad account that spends money are
 * three separate records — never one.
 */
export const ASSET_LAYERS = [
  'Page / Profile / Channel',
  'Business / Portfolio Manager',
  'Ads Manager / Advertising Account',
];

export const SOCIAL_ACCOUNT_STATUSES = [
  'To Be Completed', // expected, but ownership, IDs, creators or controls are not fully recorded
  'Active',
  'Inactive',
  'Suspended',
  'Archived',
];

export const SOCIAL_ACCESS_STATUSES = ['Pending Entry', 'Pending Approval', 'Active', 'Suspended', 'Removed'];

/**
 * The seven rights the PRD tracks separately. Billing and user management are
 * the two that matter most: governance rule 9 requires billing access to be
 * limited and identified apart from publishing or campaign work.
 */
export const SOCIAL_RIGHTS = [
  'can_publish',
  'can_reply_moderate',
  'can_view_analytics',
  'can_create_ads',
  'can_edit_campaigns',
  'can_manage_billing',
  'can_manage_users',
];

/** Free public providers — governance rule 4 forbids these as sole owner or recovery. */
const PUBLIC_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'yahoo.com', 'ymail.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  'mail.ru', 'yandex.com', 'gmx.com', 'zoho.com', 'qq.com',
];

export const isPersonalEmail = (email) => {
  if (!email) return false;
  const domain = String(email).toLowerCase().split('@')[1];
  return !!domain && PUBLIC_EMAIL_DOMAINS.includes(domain);
};

/** Statuses in which an access grant is no longer live. */
export const SOCIAL_ACCESS_CLOSED = ['Removed'];
