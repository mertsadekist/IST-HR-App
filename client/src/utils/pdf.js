/**
 * Client-side PDF generation.
 *
 * We render the on-screen document (letter, offer, receipt, report…) to a PDF
 * in the browser so Arabic shaping/RTL and the company branding come out exactly
 * as displayed. The resulting Blob is uploaded to /api/email/send-document where
 * the server attaches it to a cover email.
 *
 * jsPDF + html2canvas are loaded dynamically so they don't bloat the initial
 * bundle — they're only pulled in the first time a user sends/downloads a PDF.
 */

const A4 = { width: 595.28, height: 841.89 }; // points, portrait

/**
 * Render a DOM element to a single multi-page A4 PDF.
 * @param {HTMLElement} element
 * @param {{ scale?: number }} [opts]
 * @returns {Promise<Blob>}
 */
export async function elementToPdfBlob(element, opts = {}) {
  if (!element) throw new Error('No element to render');
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, {
    scale: opts.scale || 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const imgWidth = A4.width;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= A4.height;
  while (heightLeft > 0) {
    position -= A4.height;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= A4.height;
  }

  return pdf.output('blob');
}

/**
 * Render an HTML string to a PDF blob by mounting it into an off-screen,
 * print-styled A4 container.
 * @param {string} html
 * @param {{ rtl?: boolean, scale?: number }} [opts]
 * @returns {Promise<Blob>}
 */
export async function htmlToPdfBlob(html, opts = {}) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '794px', // ~A4 width @96dpi
    background: '#ffffff',
    padding: '48px',
    boxSizing: 'border-box',
    color: '#1e293b',
    fontFamily: "'Segoe UI', Tahoma, system-ui, sans-serif",
    fontSize: '14px',
    lineHeight: '1.7',
  });
  if (opts.rtl) {
    host.setAttribute('dir', 'rtl');
    host.style.textAlign = 'right';
  }
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    return await elementToPdfBlob(host, opts);
  } finally {
    document.body.removeChild(host);
  }
}

/** Trigger a browser download of a blob. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
