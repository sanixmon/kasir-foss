import Swal from 'sweetalert2';

// ─── Tema Dinamis ─────────────────────────────────────────────────────────────
// Dibaca saat dialog muncul agar selalu sesuai tema dark/light yang aktif

function getThemeVars() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    background:        isLight ? '#ffffff' : '#1c2128',
    color:             isLight ? '#1c2128' : '#e6edf3',
    cancelButtonColor: isLight ? '#e2e6ea' : '#3d444d',
  };
}

function makeMixin(extra = {}) {
  const tv = getThemeVars();
  return Swal.mixin({
    background: tv.background,
    color: tv.color,
    confirmButtonColor: '#58a6ff',
    cancelButtonColor: tv.cancelButtonColor,
    iconColor: '#58a6ff',
    customClass: {
      popup:         'swal-kasir-popup',
      confirmButton: 'swal-kasir-confirm',
      cancelButton:  'swal-kasir-cancel',
      title:         'swal-kasir-title',
    },
    buttonsStyling: true,
    showClass: { popup: 'swal2-show' },
    hideClass: { popup: 'swal2-hide' },
    ...extra,
  });
}

function makeToast() {
  return makeMixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function swalSuccess(title, text) {
  return makeToast().fire({ icon: 'success', title, text });
}

export function swalError(title, text) {
  return makeToast().fire({ icon: 'error', title, text });
}

export function swalWarning(title, text) {
  return makeToast().fire({ icon: 'warning', title, text });
}

export function swalInfo(title, text) {
  return makeToast().fire({ icon: 'info', title, text });
}

/** Dialog konfirmasi — kembalikan true jika dikonfirmasi */
export async function swalConfirm(title, text, confirmText = 'Ya, Hapus!', icon = 'warning') {
  const result = await makeMixin().fire({
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Batal',
    confirmButtonColor: (icon === 'warning' || icon === 'error') ? '#ef4444' : '#58a6ff',
  });
  return result.isConfirmed;
}

export default { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm };
