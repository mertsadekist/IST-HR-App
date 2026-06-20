import { useState, useEffect, useRef } from 'react';
import * as emailApi from '@api/emailApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import { toast } from 'react-toastify';
import {
  FileText, Eye, Search, Mail, Send, Palette,
  Users, UserCheck, DoorOpen, Laptop, Trophy,
  Scale, Briefcase, CreditCard, Sparkles, X, Copy
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* ── group config ── */
const groupConfig = {
  Employee:    { icon: Users,     gradient: 'from-emerald-500 to-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  Onboarding:  { icon: UserCheck, gradient: 'from-blue-500 to-blue-700',      bg: 'bg-blue-50',     border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700' },
  Offboarding: { icon: DoorOpen,  gradient: 'from-amber-500 to-amber-700',    bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  Assets:      { icon: Laptop,    gradient: 'from-cyan-500 to-cyan-700',      bg: 'bg-cyan-50',     border: 'border-cyan-200',    text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-700' },
  Recruitment: { icon: Briefcase, gradient: 'from-indigo-500 to-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200',  text: 'text-indigo-700',  badge: 'bg-indigo-100 text-indigo-700' },
  Payroll:     { icon: CreditCard,gradient: 'from-violet-500 to-violet-700',  bg: 'bg-violet-50',   border: 'border-violet-200',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700' },
  Performance: { icon: Trophy,    gradient: 'from-rose-500 to-rose-700',      bg: 'bg-rose-50',     border: 'border-rose-200',    text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700' },
  Legal:       { icon: Scale,     gradient: 'from-orange-500 to-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700' },
  General:     { icon: Mail,      gradient: 'from-surface-500 to-surface-700',bg: 'bg-surface-50',  border: 'border-surface-200', text: 'text-surface-700', badge: 'bg-surface-100 text-surface-700' },
};

/* ── sample data for previews ── */
const sampleData = {
  name: 'Ahmad Al-Farsi',
  company: 'IST Technology',
  position: 'Senior Developer',
  department: 'Engineering',
  start_date: '2026-06-01',
  employee_code: 'EMP-0042',
  last_working_day: '2026-07-15',
  notice_period: '30 days',
  asset_name: 'MacBook Pro 16"',
  asset_type: 'Hardware',
  serial: 'SN-2026-MBP-001',
  asset_code: 'AST-0015',
  issued_date: '2026-01-15',
  return_date: '2026-07-15',
  eosb_amount: 'AED 45,000',
  pending_salary: 'AED 12,500',
  leave_balance: '14 days',
  interview_date: '2026-07-10',
  interview_time: '10:00 AM',
  interviewer: 'Sarah Johnson',
  month: 'May 2026',
  basic_salary: 'AED 15,000',
  allowances: 'AED 5,000',
  deductions: 'AED 1,200',
  net_salary: 'AED 18,800',
  period: 'Q1 2026',
  reviewer: 'Mohammad Ali',
  rating: '4.5 / 5',
  letter_type: 'Experience Certificate',
  date: '2026-07-20',
  reference: 'REF-2026-0042',
  tasks: ['Complete documentation', 'Setup workstation', 'Meet the team', 'HR orientation'],
  handover_to: 'Khalid Ibrahim',
  assets_list: ['MacBook Pro 16"', 'External Monitor', 'USB-C Hub', 'Access Card'],
};

export default function TemplateManager() {
  const { t } = useTranslation();
  const iframeRef = useRef(null);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  /* ── load templates ── */
  useEffect(() => {
    setLoading(true);
    emailApi.getTemplates()
      .then(res => {
        const data = res.data?.data ?? res.data ?? [];
        setTemplates(data);
      })
      .catch(() => toast.error(t('toasts.t_failed_to_load_templates')))
      .finally(() => setLoading(false));
  }, []);

  /* ── groups ── */
  const groups = [...new Set(templates.map(t => t.group))];
  const grouped = templates.reduce((acc, tpl) => {
    const g = tpl.group || 'General';
    if (!acc[g]) acc[g] = [];
    acc[g].push(tpl);
    return acc;
  }, {});

  /* ── filter ── */
  const filteredGroups = Object.entries(grouped)
    .filter(([group]) => !activeGroup || group === activeGroup)
    .map(([group, items]) => ({
      group,
      items: items.filter(tpl =>
        !search ||
        tpl.label?.toLowerCase().includes(search.toLowerCase()) ||
        tpl.value?.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(g => g.items.length > 0);

  /* ── preview ── */
  const handlePreview = async (tpl) => {
    setPreviewData(tpl);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const res = await emailApi.previewTemplate({
        templateType: tpl.value,
        data: sampleData,
      });
      const html = res.data?.html ?? '';
      setPreviewHtml(html);
    } catch {
      toast.error(t('toasts.t_failed_to_preview_template'));
      setPreviewHtml('<p style="padding:20px;color:#ef4444;">Failed to generate preview</p>');
    } finally {
      setPreviewLoading(false);
    }
  };

  /* ── write preview html to iframe ── */
  useEffect(() => {
    if (previewOpen && iframeRef.current && previewHtml) {
      const doc = iframeRef.current.contentDocument;
      if (doc) { doc.open(); doc.write(previewHtml); doc.close(); }
    }
  }, [previewOpen, previewHtml]);

  /* ── copy template key ── */
  const copyKey = (value) => {
    navigator.clipboard.writeText(value);
    toast.success(`Template key "${value}" copied!`);
  };

  const totalCount = templates.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">
            {t('email.template_manager', 'Email Template Manager')}
          </h1>
          <p className="text-surface-500 mt-0.5 text-sm">
            {t('email.template_manager_desc', 'Preview and manage all email templates used across the system')}
          </p>
        </div>
        <Badge variant="brand" className="!text-sm !px-4 !py-1.5">
          <Sparkles size={14} className="mr-1" />
          {totalCount} {t('email.templates', 'Templates')}
        </Badge>
      </div>

      {/* Group Stats Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2">
        {groups.map(group => {
          const cfg = groupConfig[group] || groupConfig.General;
          const Icon = cfg.icon;
          const count = grouped[group]?.length || 0;
          const isActive = activeGroup === group;
          return (
            <button
              key={group}
              onClick={() => setActiveGroup(isActive ? '' : group)}
              className={`relative overflow-hidden rounded-xl p-3 text-left transition-all duration-200 border ${
                isActive
                  ? `bg-gradient-to-br ${cfg.gradient} text-white border-transparent shadow-lg scale-[1.02]`
                  : `${cfg.bg} ${cfg.border} hover:shadow-md hover:scale-[1.01]`
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white/80' : cfg.text} />
              <p className={`text-lg font-bold mt-1 ${isActive ? 'text-white' : cfg.text}`}>{count}</p>
              <p className={`text-[10px] font-medium truncate ${isActive ? 'text-white/70' : 'text-surface-500'}`}>{group}</p>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input
            type="text"
            placeholder={t('email.search_templates', 'Search templates...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus"
          />
        </div>
        {(search || activeGroup) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(''); setActiveGroup(''); }}
          >
            <X size={14} /> Clear
          </Button>
        )}
      </div>

      {/* Template Groups */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse !p-5">
              <div className="h-4 bg-surface-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-surface-100 rounded w-1/2 mb-2" />
              <div className="h-8 bg-surface-100 rounded w-full" />
            </Card>
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card className="text-center !py-12">
          <FileText size={40} className="mx-auto text-surface-300 mb-3" />
          <p className="text-surface-500 font-medium">No templates found</p>
          <p className="text-surface-400 text-sm mt-1">Try adjusting your search or filter</p>
        </Card>
      ) : (
        filteredGroups.map(({ group, items }) => {
          const cfg = groupConfig[group] || groupConfig.General;
          const Icon = cfg.icon;
          return (
            <div key={group} className="space-y-3">
              {/* Group Header */}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${cfg.badge} flex items-center justify-center`}>
                  <Icon size={16} />
                </div>
                <h2 className="text-base font-semibold text-surface-800">{group}</h2>
                <Badge variant="secondary" className="!text-[10px]">{items.length}</Badge>
              </div>

              {/* Template Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(tpl => (
                  <div
                    key={tpl.value}
                    className={`group relative rounded-xl border ${cfg.border} ${cfg.bg} p-4 hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.01]`}
                    onClick={() => handlePreview(tpl)}
                  >
                    {/* Template Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg ${cfg.badge} flex items-center justify-center`}>
                          <FileText size={14} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-surface-800 leading-tight">{tpl.label}</h3>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyKey(tpl.value); }}
                        className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-white/60 opacity-0 group-hover:opacity-100 transition-all"
                        title="Copy template key"
                      >
                        <Copy size={13} />
                      </button>
                    </div>

                    {/* Template Key */}
                    <code className="text-[11px] text-surface-500 bg-white/60 px-2 py-0.5 rounded-md font-mono">
                      {tpl.value}
                    </code>

                    {/* Preview Button */}
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-[10px] font-medium ${cfg.text}`}>{group}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-surface-400 group-hover:text-brand-600 transition-colors">
                        <Eye size={12} /> Preview
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Preview Modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewData?.label || 'Template Preview'}
        description={`Template key: ${previewData?.value || ''}`}
        size="xl"
      >
        {previewData && (
          <div className="space-y-4">
            {/* Template Info */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="brand">{previewData.group}</Badge>
              <code className="text-xs text-surface-500 bg-surface-100 px-2.5 py-1 rounded-lg font-mono">
                {previewData.value}
              </code>
              <button
                onClick={() => copyKey(previewData.value)}
                className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <Copy size={12} /> Copy Key
              </button>
            </div>

            {/* Sample Data Notice */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs">
              <Palette size={14} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Sample Data Preview</span> — This preview uses placeholder data to demonstrate the template layout. 
                Actual emails will be populated with real employee/candidate information.
              </div>
            </div>

            {/* Preview iFrame */}
            {previewLoading ? (
              <div className="flex items-center justify-center py-20 bg-surface-50 rounded-xl border border-surface-200">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-surface-500">Generating preview...</p>
                </div>
              </div>
            ) : (
              <div className="border border-surface-200 rounded-xl overflow-hidden bg-white shadow-inner">
                <iframe
                  ref={iframeRef}
                  title="Template Preview"
                  className="w-full border-0"
                  style={{ minHeight: '500px' }}
                  sandbox="allow-same-origin"
                />
              </div>
            )}

            {/* Usage Guide */}
            <div className="p-3 rounded-xl bg-surface-50 border border-surface-100">
              <p className="text-[10px] text-surface-400 uppercase tracking-wider font-medium mb-2">API Usage</p>
              <pre className="text-xs text-surface-600 bg-white rounded-lg p-3 border border-surface-100 overflow-x-auto font-mono">
{`POST /api/email/send-template
{
  "to": "employee@company.com",
  "toName": "Ahmad Al-Farsi",
  "templateType": "${previewData.value}",
  "data": { "name": "Ahmad", "company": "IST" }
}`}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-100">
              <Button variant="ghost" size="sm" onClick={() => copyKey(previewData.value)}>
                <Copy size={14} /> Copy Key
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
                  {t('common.close', 'Close')}
                </Button>
                <Button variant="primary" onClick={() => {
                  setPreviewOpen(false);
                  // Could open compose modal here in future
                  toast.info(t('toasts.t_use_the_buttons_across_the_app_to_send_this_templa'));
                }}>
                  <Send size={14} /> {t('email.use_template', 'Use Template')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
