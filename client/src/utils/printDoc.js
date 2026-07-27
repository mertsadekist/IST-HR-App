import { getCompany, getLetterheadBytes } from '@api/companiesApi';
import { companyLetterhead } from '@utils/letterhead';
import { composeWithLetterhead, elementToPdfBlob, downloadBlob } from '@utils/pdf';

/**
 * Render a DOM element to PDF on the company letterhead and download it.
 * Falls back to a plain A4 render when the company has no letterhead on file.
 *
 * The element is normally an off-screen printable component:
 *   <div style={{ position:'fixed', left:'-9999px', top:0, width:'800px' }}>…</div>
 * Give React a tick to commit before calling this (see waitForPaint below).
 *
 * @returns {Promise<Blob>} the generated PDF (already downloaded)
 */
export async function printElementWithLetterhead(element, companyId, filename = 'document.pdf') {
  if (!element) throw new Error('Nothing to print');

  let lh = null;
  if (companyId) {
    try { const { data } = await getCompany(companyId); lh = companyLetterhead(data); }
    catch { /* no letterhead — fall through to a plain render */ }
  }

  let blob;
  if (lh?.companyId) {
    const res = await getLetterheadBytes(lh.companyId);
    blob = await composeWithLetterhead({
      letterheadBytes: res.data, letterheadType: lh.type, element, marginsMm: lh.margins,
    });
  } else {
    blob = await elementToPdfBlob(element);
  }
  downloadBlob(blob, filename);
  return blob;
}

/** Lets React commit the off-screen component before html2canvas reads it. */
export const waitForPaint = (ms = 200) => new Promise((r) => setTimeout(r, ms));
