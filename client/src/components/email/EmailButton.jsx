import { useState, lazy, Suspense } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@components/ui/Button';

const ComposeEmailModal = lazy(() => import('./ComposeEmailModal'));

export default function EmailButton({
  to,
  toName,
  templateType,
  templateData,
  relatedModule,
  relatedId,
  companyId,
  size = 'sm',
  variant = 'icon',
  label,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const fallback = (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-5 w-5 animate-spin text-brand-700" />
    </div>
  );

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title={t('email.sendEmail', 'Send Email')}
          className="p-1.5 text-surface-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
        >
          <Mail size={size === 'sm' ? 16 : 18} />
        </button>
      ) : (
        <Button
          size={size}
          variant="secondary"
          onClick={() => setOpen(true)}
        >
          <Mail size={size === 'sm' ? 14 : 16} />
          {label || t('email.sendEmail', 'Send Email')}
        </Button>
      )}

      {open && (
        <Suspense fallback={fallback}>
          <ComposeEmailModal
            open={open}
            onClose={() => setOpen(false)}
            defaultTo={to}
            defaultToName={toName}
            defaultTemplate={templateType}
            defaultTemplateData={templateData}
            relatedModule={relatedModule}
            relatedId={relatedId}
            companyId={companyId}
          />
        </Suspense>
      )}
    </>
  );
}
