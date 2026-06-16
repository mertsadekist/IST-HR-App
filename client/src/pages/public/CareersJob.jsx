import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import * as publicApi from '@api/publicApi';
import { Loader2, MapPin, Briefcase, Building2, Upload, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

const apiErr = (e, f) => e?.response?.data?.missing?.join(' · ') || e?.response?.data?.error || f;

export default function CareersJob() {
  const { slug } = useParams();
  const [sp] = useSearchParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1 review · 2 consent · 3 form · 4 success
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({});
  const [cv, setCv] = useState(null);

  useEffect(() => {
    (async () => {
      try { const { data } = await publicApi.getJob(slug); setJob(data); }
      catch (e) { setError(apiErr(e, 'This job posting is not available')); }
      finally { setLoading(false); }
    })();
  }, [slug]);

  const brand = job?.color_primary || '#6D28D9';
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email || !form.phone) { setError('Please complete the required fields.'); return; }
    setSubmitting(true); setError(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v != null && v !== '' && fd.append(k, v));
      fd.append('consent', 'true');
      fd.append('privacy_version', job.privacy_version || 'v1');
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'source'].forEach((p) => {
        const val = sp.get(p); if (val) fd.append(p, val);
      });
      if (cv) fd.append('cv', cv);
      await publicApi.applyToJob(slug, fd);
      setStep(4);
    } catch (err) { setError(apiErr(err, 'Could not submit your application.')); }
    finally { setSubmitting(false); }
  };

  if (loading) return <Center><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></Center>;
  if (error && !job) return <Center><div className="text-center"><AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" /><p className="text-slate-600">{error}</p></div></Center>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Branded hero */}
      <div className="text-white" style={{ background: `linear-gradient(135deg, ${brand}, ${job.color_secondary || '#1D1245'})` }}>
        <div className="max-w-3xl mx-auto px-5 py-8">
          <div className="flex items-center gap-3 mb-5">
            {job.company_logo
              ? <img src={job.company_logo} alt={job.company_name} className="w-12 h-12 rounded-xl object-contain bg-white p-1" />
              : <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center"><Building2 size={22} /></div>}
            <div>
              <p className="text-sm opacity-90">{job.company_name}</p>
              {job.company_industry && <p className="text-xs opacity-70">{job.company_industry}</p>}
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">{job.title}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm opacity-90">
            {job.department_name && <span className="inline-flex items-center gap-1"><Briefcase size={14} /> {job.department_name}</span>}
            {job.work_location && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {job.work_location}</span>}
            {job.employment_type && <span>· {job.employment_type}</span>}
            {job.workplace_type && <span>· {job.workplace_type}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6">
        {step === 1 && (
          <div className="space-y-5">
            {job.is_closed && <div className="p-3 rounded-xl bg-amber-50 text-amber-700 text-sm">The application deadline for this job has passed.</div>}
            <Section title="About the role" body={job.description} />
            <Section title="Key responsibilities" body={job.responsibilities} />
            <Section title="Requirements & qualifications" body={job.qualifications} />
            <Section title="Required skills" body={job.required_skills} />
            <Section title="Preferred skills" body={job.preferred_skills} />
            {job.languages && <Section title="Languages" body={job.languages} />}
            {job.benefits && <Section title="Benefits" body={job.benefits} />}
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              {job.experience_required && <Chip>Experience: {job.experience_required}</Chip>}
              {job.working_hours && <Chip>Hours: {job.working_hours}</Chip>}
              {job.show_salary && (job.salary_min || job.salary_max) && <Chip>Salary: {job.salary_min || '—'} – {job.salary_max || '—'}</Chip>}
              {job.application_deadline && <Chip>Apply by: {job.application_deadline}</Chip>}
            </div>
            {!job.is_closed && (
              <button onClick={() => setStep(2)} className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-semibold shadow-sm" style={{ background: brand }}>
                Start Application
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><ShieldCheck size={18} style={{ color: brand }} /> Privacy & Data Protection</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              By submitting this application you agree that <strong>{job.company_name}</strong> may collect, store, process and review
              your personal data and CV for recruitment purposes related to this and similar future roles. Your data will be handled
              confidentially and only by authorized HR personnel. You may request deletion of your data at any time.
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer text-sm text-slate-700">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4" />
              I have read and accept the privacy &amp; data-protection terms.
            </label>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl text-sm bg-slate-100 text-slate-600">Back</button>
              <button disabled={!consent} onClick={() => setStep(3)} className="px-5 py-2 rounded-xl text-sm text-white font-semibold disabled:opacity-40" style={{ background: brand }}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Your Application</h2>
            {error && <div className="p-2.5 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="First name" req value={form.first_name} onChange={(v) => set('first_name', v)} />
              <Field label="Last name" req value={form.last_name} onChange={(v) => set('last_name', v)} />
              <Field label="Email" req type="email" value={form.email} onChange={(v) => set('email', v)} />
              <Field label="Phone" req value={form.phone} onChange={(v) => set('phone', v)} />
              <Field label="Current location" value={form.current_location} onChange={(v) => set('current_location', v)} />
              <Field label="Nationality" value={form.nationality} onChange={(v) => set('nationality', v)} />
              <Field label="Current job title" value={form.current_job_title} onChange={(v) => set('current_job_title', v)} />
              <Field label="Years of experience" type="number" value={form.years_experience} onChange={(v) => set('years_experience', v)} />
              <Field label="Expected salary" value={form.expected_salary} onChange={(v) => set('expected_salary', v)} />
              <Field label="Notice period" value={form.notice_period} onChange={(v) => set('notice_period', v)} />
              <Field label="Available joining date" type="date" value={form.available_date} onChange={(v) => set('available_date', v)} />
              <Field label="LinkedIn URL" value={form.linkedin_url} onChange={(v) => set('linkedin_url', v)} />
              <Field label="Portfolio / website" value={form.portfolio_url} onChange={(v) => set('portfolio_url', v)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Cover letter / message</label>
              <textarea rows={3} value={form.cover_letter || ''} onChange={(e) => set('cover_letter', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">CV / Resume (PDF or DOC/DOCX)</label>
              <label className="mt-1 flex items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl px-3 py-3 cursor-pointer hover:border-violet-400">
                <Upload size={16} className="text-slate-400" />
                <span className="text-sm text-slate-500">{cv ? cv.name : 'Click to upload your CV'}</span>
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => setCv(e.target.files?.[0] || null)} />
              </label>
            </div>
            {/* Honeypot (hidden from humans) */}
            <input type="text" name="company_url" tabIndex={-1} autoComplete="off" value={form.company_url || ''} onChange={(e) => set('company_url', e.target.value)} className="hidden" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="px-4 py-2 rounded-xl text-sm bg-slate-100 text-slate-600">Back</button>
              <button type="submit" disabled={submitting} className="px-6 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-50 inline-flex items-center gap-2" style={{ background: brand }}>
                {submitting && <Loader2 size={15} className="animate-spin" />} Submit Application
              </button>
            </div>
          </form>
        )}

        {step === 4 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <CheckCircle2 className="w-14 h-14 mx-auto mb-3" style={{ color: brand }} />
            <h2 className="text-xl font-bold text-slate-800">Application submitted!</h2>
            <p className="text-slate-600 mt-2 max-w-md mx-auto">Thank you for applying for <strong>{job.title}</strong> at {job.company_name}. Our recruitment team will review your application and contact you about the next steps.</p>
          </div>
        )}
      </div>
      <footer className="max-w-3xl mx-auto px-5 py-6 text-center text-xs text-slate-400">Powered by IST HR System</footer>
    </div>
  );
}

const Center = ({ children }) => <div className="min-h-screen flex items-center justify-center bg-slate-50">{children}</div>;
const Chip = ({ children }) => <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs">{children}</span>;
function Section({ title, body }) {
  if (!body) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-800 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{body}</p>
    </div>
  );
}
function Field({ label, req, type = 'text', value, onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}{req && <span className="text-red-500"> *</span>}</label>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-violet-200" />
    </div>
  );
}
