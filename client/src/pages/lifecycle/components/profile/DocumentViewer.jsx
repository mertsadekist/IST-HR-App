import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Download, ExternalLink, ChevronLeft, ChevronRight, Loader2, FileWarning, FileText } from 'lucide-react';
import * as employeesApi from '@api/employeesApi';
import { docTypeLabel } from '@utils/employeeDocs';
import { mimeFromName, previewKind, tierLabel, expiryTier, TIER_STYLES } from './profileUtils';

/**
 * Opens an employee document in the browser: PDFs and text in a frame, images
 * as an image, anything else (Word files) with a download button. The file is
 * fetched with the session token and shown from a local object URL, so the
 * download endpoint and its access checks are unchanged.
 *
 * `docs` + `index` let the person step through the employee's files with the
 * arrows (or ← / →) without closing the viewer.
 */
export default function DocumentViewer({ employeeId, docs, index, onIndexChange, onClose, t }) {
  const doc = index != null ? docs[index] : null;
  const [file, setFile] = useState({ id: null, url: null, failed: false });
  const ready = doc && file.id === doc.id;
  const kind = doc ? previewKind(doc.file_name) : null;

  useEffect(() => {
    if (!doc) return undefined;
    let alive = true;
    let url = null;
    employeesApi.downloadEmployeeDocument(employeeId, doc.id)
      .then((res) => {
        const type = mimeFromName(doc.file_name) || res.data?.type || 'application/octet-stream';
        url = URL.createObjectURL(new Blob([res.data], { type }));
        if (alive) setFile({ id: doc.id, url, failed: false });
        else URL.revokeObjectURL(url);
      })
      .catch(() => { if (alive) setFile({ id: doc.id, url: null, failed: true }); });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [employeeId, doc]);

  const go = (step) => {
    if (!docs.length) return;
    onIndexChange((index + step + docs.length) % docs.length);
  };

  useEffect(() => {
    if (!doc) return undefined;
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT' || docs.length < 2) return;
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
      if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tier = doc?.expiry_date ? expiryTier(doc.days_left) : null;

  return (
    <Dialog.Root open={!!doc} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content className="fixed z-50 inset-2 sm:inset-6 lg:inset-x-[6vw] lg:inset-y-6 bg-white rounded-2xl shadow-modal flex flex-col overflow-hidden animate-slide-up">
          {doc && (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-200">
                <FileText size={18} className="text-brand-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="text-sm font-semibold text-surface-900 truncate">{doc.file_name}</Dialog.Title>
                  <Dialog.Description className="text-[11px] text-surface-500 truncate">
                    {[doc.doc_type && docTypeLabel(t, doc.doc_type), doc.doc_number, doc.expiry_date && `${t('empDocs.expiry_date')}: ${doc.expiry_date}`]
                      .filter(Boolean).join(' · ') || t('empProfile.viewer_counter', { n: index + 1, total: docs.length })}
                  </Dialog.Description>
                </div>
                {tier && (
                  <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${TIER_STYLES[tier.tone].pill}`}>
                    {tierLabel(t, doc.days_left)}
                  </span>
                )}
                {docs.length > 1 && (
                  <span className="hidden md:inline text-[11px] text-surface-400 tabular-nums">{index + 1} / {docs.length}</span>
                )}
                {ready && file.url && (
                  <>
                    <a href={file.url} target="_blank" rel="noreferrer" title={t('empProfile.viewer_open_tab')}
                      className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 hover:text-brand-700">
                      <ExternalLink size={16} />
                    </a>
                    <a href={file.url} download={doc.file_name} title={t('empDocs.download')}
                      className="p-2 rounded-lg text-surface-500 hover:bg-surface-100 hover:text-brand-700">
                      <Download size={16} />
                    </a>
                  </>
                )}
                <Dialog.Close asChild>
                  <button type="button" className="p-2 rounded-lg text-surface-500 hover:bg-surface-100" aria-label={t('common.close')}>
                    <X size={18} />
                  </button>
                </Dialog.Close>
              </div>

              <div className="relative flex-1 bg-surface-100 min-h-0">
                {!ready ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-surface-500 text-sm">
                    <Loader2 className="w-7 h-7 text-brand-600 animate-spin" /> {t('empProfile.viewer_loading')}
                  </div>
                ) : file.failed ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-600 text-sm">
                    <FileWarning className="w-8 h-8" /> {t('empProfile.viewer_failed')}
                  </div>
                ) : kind === 'image' ? (
                  <div className="absolute inset-0 overflow-auto flex items-center justify-center p-4">
                    <img src={file.url} alt={doc.file_name} className="max-w-full max-h-full object-contain rounded-lg shadow-md bg-white" />
                  </div>
                ) : kind ? (
                  <iframe src={file.url} title={doc.file_name} className="absolute inset-0 w-full h-full bg-white" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-surface-600 text-sm p-6 text-center">
                    <FileText className="w-10 h-10 text-surface-400" />
                    <p>{t('empProfile.viewer_no_preview')}</p>
                    <a href={file.url} download={doc.file_name}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700">
                      <Download size={15} /> {t('empDocs.download')}
                    </a>
                  </div>
                )}

                {docs.length > 1 && (
                  <>
                    <button type="button" onClick={() => go(-1)} title={t('empProfile.viewer_prev')}
                      className="absolute start-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center text-surface-700 hover:bg-white">
                      <ChevronLeft size={20} className="rtl:rotate-180" />
                    </button>
                    <button type="button" onClick={() => go(1)} title={t('empProfile.viewer_next')}
                      className="absolute end-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center text-surface-700 hover:bg-white">
                      <ChevronRight size={20} className="rtl:rotate-180" />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
