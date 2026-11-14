import { confirmWarning } from './confirm';

// One entry per warning code the server can raise (server/services/softWarnings.js).
// Written out rather than built from the code so each key is visible to the i18n audit.
const WARNING_TEXT = {
  expiry_before_issue: 'softWarn.expiry_before_issue',
};

/**
 * Send a request that may come back as "needs confirmation".
 *
 * `send(confirmed)` makes the request, adding `confirm_warnings` when `confirmed`
 * is true. If the server answers 409 `needs_confirmation`, the person is shown the
 * warnings and decides: confirm and the request is repeated with the confirmation,
 * or cancel and an error with `cancelled: true` is thrown so the caller can simply
 * stop without showing a failure. Anything else is rethrown untouched.
 *
 * @param {(confirmed: boolean) => Promise<any>} send
 * @param {Function} t  i18next translate function
 * @param {{onAsk?: Function, onConfirmed?: Function}} [hooks] e.g. to hide a loading toast while the dialog is open
 */
export async function sendWithWarnings(send, t, hooks = {}) {
  try {
    return await send(false);
  } catch (err) {
    const data = err?.response?.data;
    if (err?.response?.status !== 409 || !data?.needs_confirmation) throw err;

    hooks.onAsk?.();
    const lines = (data.warnings || []).map((w) => t(WARNING_TEXT[w.code] || 'softWarn.generic', {
      defaultValue: w.message,
      issue: w.issue_date, expiry: w.expiry_date,
    }));
    const answer = await confirmWarning({
      title: t('softWarn.title'),
      text: lines.join('\n'),
      confirmText: t('softWarn.confirm'),
      cancelText: t('softWarn.cancel'),
    });
    if (!answer.isConfirmed) {
      const cancelled = new Error('cancelled');
      cancelled.cancelled = true;
      throw cancelled;
    }
    hooks.onConfirmed?.();
    return send(true);
  }
}
