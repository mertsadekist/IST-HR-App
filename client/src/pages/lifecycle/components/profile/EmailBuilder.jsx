import { useState, useMemo } from 'react';

// Public providers offered to staff who are not yet under contract — they must
// not hold an official company address before the labour contract and residency
// are in place.
const PUBLIC_EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];
const OTHER = '__other__';

/**
 * Email as "local part" + a domain picker. The composed value is still a plain
 * string, so the surrounding save logic is unchanged. An existing address whose
 * domain is in neither list is preserved as its own option rather than rewritten.
 */
export default function EmailBuilder({ value, onChange, companyDomains, contracted, t }) {
  const at = String(value || '').lastIndexOf('@');
  const local = at >= 0 ? String(value).slice(0, at) : String(value || '');
  const domain = at >= 0 ? String(value).slice(at + 1) : '';

  const options = useMemo(() => {
    const list = [...companyDomains, ...PUBLIC_EMAIL_DOMAINS];
    if (domain && !list.includes(domain)) list.push(domain);
    return [...new Set(list)];
  }, [companyDomains, domain]);

  const [freeform, setFreeform] = useState(false);
  const compose = (l, d) => onChange(l && d ? `${l}@${d}` : l || '');
  const usingCompanyDomain = companyDomains.includes(domain);

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <input value={local} onChange={(e) => compose(e.target.value.trim(), domain)}
          placeholder={t('employees.email_local_part')} className="flex-1 min-w-0 text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
        <span className="text-xs text-surface-400 self-center">@</span>
        {freeform ? (
          <input autoFocus value={domain} onChange={(e) => compose(local, e.target.value.trim().toLowerCase())}
            onBlur={() => domain && setFreeform(false)}
            placeholder="example.com" className="w-36 text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
        ) : (
          <select value={domain} onChange={(e) => {
            if (e.target.value === OTHER) { setFreeform(true); compose(local, ''); return; }
            compose(local, e.target.value);
          }} className="w-36 text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5">
            <option value="">{t('employees.select_domain')}</option>
            {options.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value={OTHER}>{t('employees.other_domain')}</option>
          </select>
        )}
      </div>
      {usingCompanyDomain && !contracted && (
        <p className="text-[10px] text-amber-600">{t('employees.company_domain_warning')}</p>
      )}
    </div>
  );
}
