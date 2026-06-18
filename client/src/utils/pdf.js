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

const MM_TO_PT = 2.834645669;

function dataUrlToUint8(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/** Render a DOM element to a transparent-background canvas. */
async function elementToCanvas(element, scale = 2) {
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(element, { scale, useCORS: true, backgroundColor: null, logging: false });
}

/** Render an HTML string to a transparent canvas via an off-screen container. */
async function htmlToCanvas(html, { rtl = false, widthPx = 794, padPx = 0 } = {}) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed', left: '-10000px', top: '0', width: `${widthPx}px`,
    background: 'transparent', padding: `${padPx}px`, boxSizing: 'border-box',
    color: '#1e293b', fontFamily: "'Segoe UI', Tahoma, system-ui, sans-serif",
    fontSize: '14px', lineHeight: '1.7',
  });
  if (rtl) { host.setAttribute('dir', 'rtl'); host.style.textAlign = 'right'; }
  host.innerHTML = html;
  document.body.appendChild(host);
  try { return await elementToCanvas(host); }
  finally { document.body.removeChild(host); }
}

/**
 * Compose a document onto a company letterhead.
 * The content (element or HTML) is rendered to a transparent image and stamped
 * onto the letterhead page(s) within the configured margins. Paginates when the
 * content is taller than one page so the letterhead repeats on every page.
 *
 * @param {Object} o
 * @param {ArrayBuffer|Uint8Array} o.letterheadBytes
 * @param {'pdf'|'png'|'jpg'} o.letterheadType
 * @param {HTMLElement} [o.element]
 * @param {string} [o.html]
 * @param {boolean} [o.rtl]
 * @param {{top:number,bottom:number,left:number,right:number}} [o.marginsMm]
 * @returns {Promise<Blob>}
 */
export async function composeWithLetterhead(o) {
  const { PDFDocument } = await import('pdf-lib');
  const marginsMm = o.marginsMm || { top: 50, bottom: 40, left: 18, right: 18 };
  const canvas = o.element ? await elementToCanvas(o.element) : await htmlToCanvas(o.html, { rtl: o.rtl });

  const out = await PDFDocument.create();
  let lhPage = null, lhImg = null, pageW = A4.width, pageH = A4.height;
  const bytes = o.letterheadBytes instanceof Uint8Array ? o.letterheadBytes : new Uint8Array(o.letterheadBytes);
  if (o.letterheadType === 'pdf') {
    const [embedded] = await out.embedPdf(bytes, [0]);
    lhPage = embedded; pageW = embedded.width; pageH = embedded.height;
  } else {
    lhImg = o.letterheadType === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    const ar = lhImg.height / lhImg.width;
    pageW = A4.width; pageH = A4.width * ar; // keep image aspect (usually ~A4)
  }

  const m = {
    top: marginsMm.top * MM_TO_PT, bottom: marginsMm.bottom * MM_TO_PT,
    left: marginsMm.left * MM_TO_PT, right: marginsMm.right * MM_TO_PT,
  };
  const contentW = pageW - m.left - m.right;
  const contentAreaH = pageH - m.top - m.bottom;
  const pxToPt = contentW / canvas.width;
  const pageContentHpx = Math.max(1, Math.floor(contentAreaH / pxToPt));
  const pages = Math.max(1, Math.ceil(canvas.height / pageContentHpx));

  for (let i = 0; i < pages; i++) {
    const page = out.addPage([pageW, pageH]);
    if (lhPage) page.drawPage(lhPage, { x: 0, y: 0, width: pageW, height: pageH });
    else page.drawImage(lhImg, { x: 0, y: 0, width: pageW, height: pageH });

    const sy = i * pageContentHpx;
    const sh = Math.min(pageContentHpx, canvas.height - sy);
    const slice = document.createElement('canvas');
    slice.width = canvas.width; slice.height = sh;
    slice.getContext('2d').drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
    const img = await out.embedPng(dataUrlToUint8(slice.toDataURL('image/png')));
    const drawH = sh * pxToPt;
    page.drawImage(img, { x: m.left, y: pageH - m.top - drawH, width: contentW, height: drawH });
  }

  return new Blob([await out.save()], { type: 'application/pdf' });
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
