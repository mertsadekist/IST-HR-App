import { cn } from '@utils/cn';

export default function EmptyState({
  icon,
  title = 'No data yet',
  description = 'Get started by creating your first item',
  action,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {icon && (
        <div className="w-14 h-14 bg-surface-100 rounded-2xl flex items-center justify-center mb-4">
          {typeof icon === 'string' ? (
            <span className="text-2xl">{icon}</span>
          ) : (
            icon
          )}
        </div>
      )}
      <h3 className="text-base font-semibold text-surface-700">{title}</h3>
      <p className="text-sm text-surface-400 mt-1 max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
