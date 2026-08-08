import Swal from 'sweetalert2';

// Our Modal is a Radix Dialog (modal), which sets `pointer-events: none` on the
// <body> while open. SweetAlert appends its popup to document.body, so it inherits
// that lock and its buttons become unclickable when a confirm is opened from inside
// a modal (e.g. the payroll run detail). Re-enable pointer events on the Swal
// container (and lift it above the dialog) so the buttons always work.
const escapeModalLock = () => {
  const c = Swal.getContainer();
  if (c) {
    c.style.pointerEvents = 'auto';
    c.style.zIndex = '99999';
  }
};

export const confirmDelete = (itemName = 'this item') =>
  Swal.fire({
    title: 'Are you sure?',
    text: `This will permanently delete ${itemName}. This action cannot be undone.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#DC2626',
    cancelButtonColor: '#737373',
    confirmButtonText: 'Yes, delete it',
    cancelButtonText: 'Cancel',
    heightAuto: false,
    didOpen: escapeModalLock,
    customClass: {
      popup: 'rounded-2xl',
      confirmButton: 'rounded-xl',
      cancelButton: 'rounded-xl',
    },
  });

/**
 * Asks for a written reason before a sensitive action. Used by the credential
 * reveal, where the server records the reason in the audit log and refuses
 * anything shorter than 10 characters.
 */
export const promptReason = (title, text) =>
  Swal.fire({
    title,
    text,
    icon: 'warning',
    input: 'textarea',
    inputAttributes: { 'aria-label': title, maxlength: '400' },
    inputValidator: (v) => (String(v || '').trim().length < 10 ? text : undefined),
    showCancelButton: true,
    confirmButtonColor: '#DC2626',
    cancelButtonColor: '#737373',
    heightAuto: false,
    didOpen: escapeModalLock,
    customClass: {
      popup: 'rounded-2xl',
      confirmButton: 'rounded-xl',
      cancelButton: 'rounded-xl',
    },
  });

/**
 * Step-up confirmation for revealing a stored credential: a reason for the audit
 * log AND the user's own password. A valid session is not enough for this action
 * — a stolen session is the likeliest route to a credential, and re-entering the
 * password is what closes it.
 */
export const promptRevealStepUp = (opts) =>
  Swal.fire({
    title: opts.title,
    icon: 'warning',
    html:
      `<p style="font-size:13px;text-align:start;margin-bottom:12px">${opts.text}</p>`
      + `<textarea id="reveal-reason" class="swal2-textarea" style="margin:0 0 10px" maxlength="400" placeholder="${opts.reasonPlaceholder}"></textarea>`
      + `<input id="reveal-password" type="password" autocomplete="current-password" class="swal2-input" style="margin:0" placeholder="${opts.passwordPlaceholder}">`,
    focusConfirm: false,
    preConfirm: () => {
      const reason = (document.getElementById('reveal-reason')?.value || '').trim();
      const password = document.getElementById('reveal-password')?.value || '';
      if (reason.length < 10) { Swal.showValidationMessage(opts.reasonTooShort); return false; }
      if (!password) { Swal.showValidationMessage(opts.passwordRequired); return false; }
      return { reason, password };
    },
    showCancelButton: true,
    confirmButtonColor: '#DC2626',
    cancelButtonColor: '#737373',
    heightAuto: false,
    didOpen: escapeModalLock,
    customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl', cancelButton: 'rounded-xl' },
  });

export const confirmAction = (title, text) =>
  Swal.fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#6D28D9',
    cancelButtonColor: '#737373',
    confirmButtonText: 'Yes, proceed',
    heightAuto: false,
    didOpen: escapeModalLock,
    customClass: {
      popup: 'rounded-2xl',
      confirmButton: 'rounded-xl',
      cancelButton: 'rounded-xl',
    },
  });
