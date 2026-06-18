import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Send, Download, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Button from '@components/ui/Button';
import { sendDocument } from '@api/emailApi';
import { elementToPdfBlob, htmlToPdfBlob, downloadBlob } from '@utils/pdf';

/**
 * Reusable "Send document by email (as PDF)" modal.
 *
 * Supply the document source via ONE of:
 *   - getElement: () => HTMLElement   (renders a live DOM node)
 *   - getHtml:    () => string        (renders an HTML string off-screen)
 *
 * The on-screen document is converted to PDF in the browser (perfect AR/EN +
 * branding), then uploaded to /api/email/send-document with a cover message.
 */
export default function SendDocumentModal({
  open,
  onClose,
  title: initialTitle = 'Document',
  getElement,
  getHtml,
  rtl = false,
  defaultTo = '',
  defaultToName = '',
  defaultCc = '',
  defaultMessage = '',
  relatedModule = 'Documents',
  relatedId = '',
  companyId = '',
}) {
  const { t } = useTranslation();
  const [to, setTo] = useState(defaultTo);
  const [toName, setToName] = useState(defaultToName);
  const [cc, setCc] = useState(defaultCc);
  const [title, setTitle] = useState(initialTitle);
  const [message, setMessage] = useState(defaultMessage);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setTo(defaultTo); setToName(defaultToName); setCc(defaultCc);
      setTitle(initialTitle); setMessage(defaultMessage); setErrors({});
    }
  }, [open, defaultTo, defaultToName, defaultCc, initialTitle, defaultMessage]);

  const buildBlob = async () => {
    if (getElement) {
      const el = getElement();
      if (!el) throw new Error('Document content not found');
      return elementToPdfBlob(el);
    }
    if (getHtml) return htmlToPdfBlob(getHtml(), { rtl });
    throw new Error('No document source provided');
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const blob = await buildBlob();
      downloadBlob(blob, `${title || 'document'}.pdf`);
    } catch (err) {
      toast.error(err.message || t('send_doc.pdf_failed', 'Failed to generate PDF'));
    } finally { setBusy(false); }
  };

  const handleSend = async () => {
    const errs = {};
    if (!to.trim()) errs.to = t('send_doc.to_required', 'Recipient email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) errs.to = t('send_doc.invalid_email', 'Enter a valid email');
    if (!title.trim()) errs.title = t('send_doc.title_required', 'Title is required');
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    const toastId = toast.loading(t('send_doc.sending', 'Generating PDF and sending…'));
    try {
      const blob = await buildBlob();
      const fd = new FormData();
      fd.append('file', blob, `${title || 'document'}.pdf`);
      fd.append('to', to.trim());
      if (toName.trim()) fd.append('toName', toName.trim());
      if (cc.trim()) fd.append('cc', cc.trim());
      fd.append('title', title.trim());
      if (message.trim()) fd.append('message', message.trim());
      fd.append('relatedModule', relatedModule);
      if (relatedId) fd.append('relatedId', relatedId);
      if (companyId) fd.append('companyId', companyId);

      await sendDocument(fd);
      toast.update(toastId, { render: t('send_doc.sent', 'Document sent successfully'), type: 'success', isLoading: false, autoClose: 3000 });
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      toast.update(toastId, { render: `${t('send_doc.failed', 'Failed to send')}: ${msg}`, type: 'error', isLoading: false, autoClose: 5000 });
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('send_doc.title_label', 'Send Document by Email')}
      description={t('send_doc.desc', 'Attaches the document as a PDF with a cover message')}
      size="lg"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-brand-50 border border-brand-100 text-sm text-brand-700">
          <Paperclip size={16} className="shrink-0" />
          {t('send_doc.attach_note', 'The document will be attached as a PDF file.')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label={t('send_doc.to', 'To')} icon={Mail} type="email" required
            placeholder="email@example.com" value={to} onChange={(e) => setTo(e.target.value)} error={errors.to} />
          <Input label={t('send_doc.recipient', 'Recipient Name')} placeholder="John Doe"
            value={toName} onChange={(e) => setToName(e.target.value)} />
        </div>

        <Input label={t('send_doc.cc', 'CC (optional, comma-separated)')} placeholder="manager@company.com, hr@company.com"
          value={cc} onChange={(e) => setCc(e.target.value)} />

        <Input label={t('send_doc.doc_title', 'Document Title')} required
          value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-surface-700">{t('send_doc.cover_note', 'Cover Note (optional)')}</label>
          <textarea rows={4} placeholder={t('send_doc.cover_placeholder', 'Add a short message to include in the email body…')}
            value={message} onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl text-surface-900 placeholder:text-surface-400 input-focus transition-all resize-y" />
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2 border-t border-surface-100">
          <Button variant="ghost" onClick={handleDownload} disabled={busy}>
            <Download size={16} /> {t('send_doc.download', 'Download PDF')}
          </Button>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none">{t('common.cancel', 'Cancel')}</Button>
            <Button variant="primary" onClick={handleSend} loading={busy} className="flex-1 sm:flex-none">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {t('send_doc.send', 'Send')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
