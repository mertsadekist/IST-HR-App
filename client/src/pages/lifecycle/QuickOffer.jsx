import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Sparkles, Send, FileText, RotateCcw } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import SendDocumentModal from '@components/email/SendDocumentModal';
import { OFFER_PRESETS } from '@/data/offerPresets';
import { buildOfferLetterHtml } from '@utils/offerLetter';

const EMP_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary'];
const OFFER_FIELDS = [
  ['job_title', 'quick_offer.f_job_title', 'text', true], ['department', 'quick_offer.f_department', 'text'],
  ['work_location', 'quick_offer.f_work_location', 'text'], ['employment_type', 'quick_offer.f_employment_type', 'select'],
  ['reporting_manager', 'quick_offer.f_reporting_manager', 'text'], ['joining_date', 'quick_offer.f_joining_date', 'date'],
  ['basic_salary', 'quick_offer.f_basic_salary', 'number'], ['commission_structure', 'quick_offer.f_commission', 'text'],
  ['probation_period', 'quick_offer.f_probation', 'text'], ['working_hours', 'quick_offer.f_working_hours', 'text'],
  ['leave_policy', 'quick_offer.f_leave_policy', 'text'], ['benefits', 'quick_offer.f_benefits', 'text'],
  ['visa_responsibility', 'quick_offer.f_visa', 'text'], ['medical_insurance', 'quick_offer.f_medical', 'text'],
  ['notice_period', 'quick_offer.f_notice', 'text'], ['offer_expiry_date', 'quick_offer.f_offer_expiry', 'date'],
];
const EMPTY_OFFER = { employment_type: 'Full-time' };

export default function QuickOffer() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [companyId, setCompanyId] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [offer, setOffer] = useState(EMPTY_OFFER);
  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    if (currentCompanyId && !companyId) setCompanyId(String(currentCompanyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId]);

  const company = useMemo(() => companies.find((c) => String(c.id) === String(companyId)), [companies, companyId]);

  const applyPreset = (preset) => {
    const { key, label, ...fields } = preset;
    setOffer({ employment_type: 'Full-time', ...fields });
  };
  const reset = () => { setOffer(EMPTY_OFFER); setCandidateName(''); setCandidateEmail(''); };

  const html = useMemo(
    () => buildOfferLetterHtml(offer, { companyName: company?.name || '', candidateName }),
    [offer, company, candidateName]
  );

  const openSend = () => {
    if (!companyId) { toast.error(t('quick_offer.select_company_first')); return; }
    if (!candidateName.trim()) { toast.error(t('quick_offer.candidate_name_required')); return; }
    if (!offer.job_title) { toast.error(t('quick_offer.job_title_required')); return; }
    setSendOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">{t('quick_offer.title')}</h1>
        <p className="text-surface-500 mt-0.5 text-sm">{t('quick_offer.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label={t('quick_offer.company')} required value={companyId} onChange={(e) => setCompanyId(e.target.value)}
              options={companies.map((c) => ({ value: String(c.id), label: c.name }))} />
            <div />
            <Input label={t('quick_offer.candidate_name')} required value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
            <Input label={t('quick_offer.candidate_email')} type="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700 block mb-1">{t('ob.use_preset')}</label>
            <div className="flex flex-wrap gap-1.5">
              {OFFER_PRESETS.map((p) => (
                <button key={p.key} type="button" onClick={() => applyPreset(p)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-surface-200 bg-white hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-colors">
                  <Sparkles size={11} className="inline -mt-0.5 mr-1" />{p.label}
                </button>
              ))}
              <button type="button" onClick={reset} className="text-xs px-2.5 py-1 rounded-lg border border-surface-200 bg-white hover:bg-surface-100 text-surface-500">
                <RotateCcw size={11} className="inline -mt-0.5 mr-1" />{t('common.reset', 'Reset')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OFFER_FIELDS.map(([k, label, type, req]) => (
              <div key={k}>
                <label className="text-xs font-semibold text-surface-700">{t(label)}{req && <span className="text-red-500"> *</span>}</label>
                {type === 'select' ? (
                  <select value={offer[k] || 'Full-time'} onChange={(e) => setOffer((f) => ({ ...f, [k]: e.target.value }))}
                    className="w-full text-sm bg-white border border-surface-200 rounded-lg px-3 py-2 mt-1">
                    {EMP_TYPES.map((o) => <option key={o} value={o}>{t(`ob.et_${o.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, o)}</option>)}
                  </select>
                ) : (
                  <input type={type} value={offer[k] || ''} onChange={(e) => setOffer((f) => ({ ...f, [k]: e.target.value }))}
                    className="w-full text-sm bg-white border border-surface-200 rounded-lg px-3 py-2 mt-1" />
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700">{t('ob.of_additional_terms')}</label>
            <textarea value={offer.additional_terms || ''} onChange={(e) => setOffer((f) => ({ ...f, additional_terms: e.target.value }))}
              rows={8} className="w-full text-sm bg-white border border-surface-200 rounded-lg px-3 py-2 mt-1 font-mono" />
          </div>

          <Button onClick={openSend}><Send size={15} /> {t('quick_offer.send_or_download')}</Button>
        </Card>

        <Card className="!p-0 overflow-hidden lg:sticky lg:top-4">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-100 bg-surface-50">
            <FileText size={14} className="text-brand-500" />
            <span className="text-xs font-semibold text-surface-600">{t('quick_offer.live_preview')}</span>
          </div>
          <div className="p-6 max-h-[75vh] overflow-y-auto bg-white" dangerouslySetInnerHTML={{ __html: html }} />
        </Card>
      </div>

      <SendDocumentModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title={`Employment Offer — ${candidateName || offer.job_title || ''}`.trim()}
        getHtml={() => html}
        rtl={false}
        defaultTo={candidateEmail}
        defaultToName={candidateName}
        relatedModule="QuickOffer"
        companyId={companyId}
        letterheadCompanyId={companyId || null}
      />
    </div>
  );
}
