import { Fragment } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@utils/cn';

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ open, onClose, title, description, size = 'md', children }) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" />
        <Dialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed z-50 bg-white shadow-modal p-6 overflow-y-auto',
            // Mobile: full-width bottom sheet
            'inset-x-0 bottom-0 rounded-t-2xl max-h-[90vh] w-full',
            // Desktop: centered modal
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
            'sm:rounded-2xl sm:w-[95vw] sm:max-h-[85vh]',
            'animate-slide-up',
            sizes[size]
          )}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-surface-900">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-surface-500 mt-1">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
