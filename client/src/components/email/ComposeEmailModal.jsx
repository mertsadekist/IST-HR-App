import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Send, Eye, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import {
  sendEmail,
  sendTemplateEmail,
  getTemplates,
  previewTemplate,
} from '@api/emailApi';

export default function ComposeEmailModal({
  open,
  onClose,
  defaultTo = '',
  defaultToName = '',
  defaultTemplate = '',
  defaultTemplateData = {},
  defaultSubject = '',
  relatedModule = '',
  relatedId = '',
  companyId = '',
}) {
  const { t } = useTranslation();
  const iframeRef = useRef(null);

  /* ───── state ───── */
  const [to, setTo] = useState(defaultTo);
  const [toName, setToName] = useState(defaultToName);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplate);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState({});

  /* ───── load templates ───── */
  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    getTemplates()
      .then((res) => setTemplates(res.data?.data ?? res.data ?? []))
      .catch(() => toast.error(t('email.loadTemplatesFailed', 'Failed to load templates')))
      .finally(() => setLoadingTemplates(false));
  }, [open, t]);

  /* ───── pre-select default template once templates loaded ───── */
  useEffect(() => {
    if (defaultTemplate && templates.length) {
      const match = templates.find(
        (tpl) => tpl.value === defaultTemplate
      );
      if (match) {
        setSelectedTemplate(match.value);
      }
    }
  }, [defaultTemplate, templates]);

  /* ───── validation ───── */
  const validate = useCallback(() => {
    const errs = {};
    if (!to.trim()) errs.to = t('email.toRequired', 'Recipient email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()))
      errs.to = t('email.invalidEmail', 'Enter a valid email address');
    if (!subject.trim()) errs.subject = t('email.subjectRequired', 'Subject is required');
    if (!selectedTemplate && !body.trim())
      errs.body = t('email.bodyRequired', 'Email body or a template is required');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [to, subject, body, selectedTemplate, t]);

  /* ───── preview ───── */
  const handlePreview = async () => {
    if (!selectedTemplate && !body.trim()) {
      toast.warning(t('email.nothingToPreview', 'Select a template or enter a body to preview'));
      return;
    }

    if (selectedTemplate) {
      try {
        const res = await previewTemplate({
          templateType: selectedTemplate,
          data: { ...defaultTemplateData, name: toName || to },
        });
        setPreviewHtml(res.data?.html ?? res.data ?? '');
      } catch {
        toast.error(t('email.previewFailed', 'Failed to generate preview'));
        return;
      }
    } else {
      setPreviewHtml(`
        <div style="font-family:system-ui,sans-serif;padding:24px;color:#1e293b;">
          ${body.replace(/\n/g, '<br/>')}
        </div>
      `);
    }
    setShowPreview(true);
  };

  /* ───── send ───── */
  const handleSend = async () => {
    if (!validate()) return;

    setSending(true);
    try {
      const payload = {
        to: to.trim(),
        toName: toName.trim() || undefined,
        subject: subject.trim(),
        relatedModule: relatedModule || undefined,
        relatedId: relatedId || undefined,
        companyId: companyId || undefined,
      };

      if (selectedTemplate) {
        await sendTemplateEmail({
          ...payload,
          templateType: selectedTemplate,
          data: { ...defaultTemplateData, name: toName || to },
        });
      } else {
        await sendEmail({ ...payload, html: `<div style="font-family:system-ui,sans-serif;padding:24px;color:#1e293b;">${body.replace(/\n/g, '<br/>')}</div>` });
      }

      toast.success(t('email.sendSuccess', 'Email sent successfully'));
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(t('email.sendFailed', 'Failed to send email') + (msg ? `: ${msg}` : ''));
    } finally {
      setSending(false);
    }
  };

  /* ───── write preview html into iframe ───── */
  useEffect(() => {
    if (showPreview && iframeRef.current && previewHtml) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [showPreview, previewHtml]);

  /* ───── active template object ───── */
  const activeTemplate = templates.find(
    (tpl) => tpl.value === selectedTemplate
  );

  const getTemplateColor = (group) => {
    const templateColors = {
      Employee: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      Onboarding: 'bg-blue-50 border-blue-200 text-blue-700',
      Offboarding: 'bg-amber-50 border-amber-200 text-amber-700',
      Payroll: 'bg-violet-50 border-violet-200 text-violet-700',
      Assets: 'bg-cyan-50 border-cyan-200 text-cyan-700',
      Performance: 'bg-rose-50 border-rose-200 text-rose-700',
      Recruitment: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      Legal: 'bg-orange-50 border-orange-200 text-orange-700',
      General: 'bg-surface-50 border-surface-200 text-surface-700',
    };
    return templateColors[group] || templateColors.General;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('email.composeEmail', 'Compose Email')}
      description={t('email.composeDesc', 'Send an email to an employee or contact')}
      size="xl"
    >
      <div className="space-y-5">
        {/* ── Recipient ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('email.to', 'To')}
            icon={Mail}
            type="email"
            required
            placeholder="email@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            error={errors.to}
          />
          <Input
            label={t('email.recipientName', 'Recipient Name')}
            placeholder={t('email.namePlaceholder', 'John Doe')}
            value={toName}
            onChange={(e) => setToName(e.target.value)}
          />
        </div>

        {/* ── Subject ── */}
        <Input
          label={t('email.subject', 'Subject')}
          required
          placeholder={t('email.subjectPlaceholder', 'Email subject line…')}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          error={errors.subject}
        />

        {/* ── Template Selector ── */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-surface-700">
            {t('email.template', 'Template')}
          </label>

          {loadingTemplates ? (
            <div className="flex items-center gap-2 py-3 text-sm text-surface-400">
              <Loader2 size={16} className="animate-spin" />
              {t('email.loadingTemplates', 'Loading templates…')}
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-surface-400 py-2">
              {t('email.noTemplates', 'No templates available — compose a custom email below')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* None / custom option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedTemplate('');
                  setSubject(defaultSubject);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  !selectedTemplate
                    ? 'bg-brand-700 border-brand-700 text-white'
                    : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'
                }`}
              >
                {t('email.customEmail', 'Custom')}
              </button>

              {templates.map((tpl) => {
                const key = tpl.value;
                const isActive = selectedTemplate === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(key);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isActive
                        ? 'bg-brand-700 border-brand-700 text-white'
                        : getTemplateColor(tpl.group)
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <FileText size={13} />
                      {tpl.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Template info badge ── */}
        {activeTemplate?.description && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-50 border border-surface-200 text-sm text-surface-600">
            <FileText size={16} className="shrink-0 mt-0.5 text-surface-400" />
            {activeTemplate.description}
          </div>
        )}

        {/* ── Body textarea (only when no template) ── */}
        {!selectedTemplate && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-700">
              {t('email.body', 'Body')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              rows={6}
              placeholder={t('email.bodyPlaceholder', 'Write your email content here…')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={`w-full px-3 py-2.5 text-sm bg-white border rounded-xl border-surface-200 text-surface-900 placeholder:text-surface-400 input-focus transition-all duration-200 resize-y ${
                errors.body ? 'border-red-400 focus:ring-red-500/30 focus:border-red-500' : ''
              }`}
            />
            {errors.body && <p className="text-xs text-red-500 mt-1">{errors.body}</p>}
          </div>
        )}

        {/* ── Preview panel ── */}
        {showPreview && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-surface-700">
                {t('email.preview', 'Preview')}
              </h4>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="p-1 text-surface-400 hover:text-surface-600 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="border border-surface-200 rounded-xl overflow-hidden bg-white">
              <iframe
                ref={iframeRef}
                title={t('email.preview', 'Preview')}
                className="w-full h-64 sm:h-80"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2 border-t border-surface-100">
          <Button variant="ghost" size="md" onClick={handlePreview}>
            <Eye size={16} />
            {t('email.previewBtn', 'Preview')}
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              className="flex-1 sm:flex-none"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={sending}
              onClick={handleSend}
              className="flex-1 sm:flex-none"
            >
              <Send size={16} />
              {t('email.send', 'Send')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
