import { forwardRef } from 'react';
import { cn } from '@utils/cn';

const Input = forwardRef(({
  label,
  error,
  icon: Icon,
  className,
  containerClassName,
  ...props
}, ref) => {
  return (
    <div className={cn('space-y-1.5', containerClassName)}>
      {label && (
        <label className="block text-sm font-medium text-surface-700">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">
            <Icon size={18} />
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-3 py-2.5 text-sm bg-white border rounded-xl',
            'border-surface-200 text-surface-900 placeholder:text-surface-400',
            'input-focus transition-all duration-200',
            Icon && 'pl-10',
            error && 'border-red-400 focus:ring-red-500/30 focus:border-red-500',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
