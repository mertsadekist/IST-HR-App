import { forwardRef } from 'react';
import { cn } from '@utils/cn';

const Select = forwardRef(({
  label,
  error,
  options = [],
  placeholder = 'Select...',
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
      <select
        ref={ref}
        className={cn(
          'w-full px-3 py-2.5 text-sm bg-white border rounded-xl appearance-none',
          'border-surface-200 text-surface-900',
          'input-focus transition-all duration-200',
          'bg-[url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3e%3cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3e%3c/svg%3e")]',
          'bg-[length:20px] bg-[right_8px_center] bg-no-repeat pr-10',
          error && 'border-red-400 focus:ring-red-500/30 focus:border-red-500',
          className
        )}
        {...props}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
