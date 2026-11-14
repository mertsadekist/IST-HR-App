/**
 * Soft warnings: rules the person entering data may overrule.
 *
 * Some checks are about data that cannot be stored (a malformed date, an unknown
 * document type) and those stay hard errors. Others are about data that is
 * unusual but real — a document whose expiry date precedes its issue date is
 * normal for some papers. Refusing those blocks legitimate entries, so they are
 * reported as warnings instead: the server answers 409 `needs_confirmation`
 * with the list, the client asks the person, and a repeat of the same request
 * carrying `confirm_warnings` goes through.
 *
 * Every warning carries a stable `code` the client translates; `message` is the
 * English fallback, also placed in `error` so a client that does not know about
 * warnings still shows something readable.
 */

export const WARNING_CODES = Object.freeze({
  EXPIRY_BEFORE_ISSUE: 'expiry_before_issue',
});

/** Did the caller confirm the warnings on a previous attempt? (multipart sends strings) */
export function isConfirmed(req) {
  const v = req.body?.confirm_warnings;
  return v === true || v === 1 || v === 'true' || v === '1';
}

/**
 * Stop the request until the person confirms. Returns true when it responded,
 * so a route can write `if (holdForConfirmation(req, res, warnings)) return;`.
 */
export function holdForConfirmation(req, res, warnings) {
  if (!warnings?.length || isConfirmed(req)) return false;
  res.status(409).json({
    needs_confirmation: true,
    warnings,
    error: warnings.map((w) => w.message).join(' '),
  });
  return true;
}

/** Text for the audit log when warnings were present and the person went ahead anyway. */
export function overrideNote(req, warnings) {
  return warnings?.length && isConfirmed(req)
    ? ` — warning confirmed by the user (${warnings.map((w) => w.code).join(', ')})`
    : '';
}

/** The expiry-before-issue warning, shared by employee and company documents. */
export function expiryBeforeIssue(issue, expiry) {
  if (!(issue && expiry && expiry < issue)) return null;
  return {
    code: WARNING_CODES.EXPIRY_BEFORE_ISSUE,
    message: 'The expiry date is before the issue date.',
    issue_date: issue,
    expiry_date: expiry,
  };
}
