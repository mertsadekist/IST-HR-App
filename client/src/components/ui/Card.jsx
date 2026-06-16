import { cn } from '@utils/cn';

export default function Card({ className, children, hover = false, ...props }) {
  return (
    <div
      className={cn(
        hover ? 'card-hover' : 'card',
        'p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ className, children }) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  );
};

Card.Title = function CardTitle({ className, children }) {
  return (
    <h3 className={cn('text-lg font-semibold text-surface-900', className)}>
      {children}
    </h3>
  );
};
