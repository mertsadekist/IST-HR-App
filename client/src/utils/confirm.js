import Swal from 'sweetalert2';

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
    customClass: {
      popup: 'rounded-2xl',
      confirmButton: 'rounded-xl',
      cancelButton: 'rounded-xl',
    },
  });
