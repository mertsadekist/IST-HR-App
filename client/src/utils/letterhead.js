/**
 * Resolve a company's letterhead config for SendDocumentModal.
 * Returns null when the company has no letterhead set.
 */
export function companyLetterhead(company) {
  if (!company || !company.letterhead_path) return null;
  let margins;
  try {
    margins = company.letterhead_margins ? JSON.parse(company.letterhead_margins) : undefined;
  } catch { margins = undefined; }
  return {
    companyId: company.id,
    type: company.letterhead_type || 'pdf',
    margins, // { top, bottom, left, right } in mm, or undefined for defaults
  };
}
