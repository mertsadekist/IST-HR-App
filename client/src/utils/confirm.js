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
