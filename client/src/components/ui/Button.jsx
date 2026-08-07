import { forwardRef } from 'react';
import { cn } from '@utils/cn';

const variants = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-brand-700 border border-brand-200 hover:bg-brand-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-surface-600 hover:bg-surface-100 hover:text-surface-900',
  accent: 'bg-accent-orange text-white hover:bg-orange-600',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-6 py-2.5 text-base rounded-xl',
  icon: 'p-2 rounded-xl',
};

const Button = forwardRef(({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  // Render as something other than <button>. The usual case is a file picker:
  // a real <button> inside a <label> swallows the click and never activates the
  // input, so those call sites need a <span> that only looks like a button.
  as: Component = 'button',
  ...props
}, ref) => {
  const isButton = Component === 'button';
  const isDisabled = disabled || loading;
  return (
    <Component
      ref={ref}
      // `disabled` is meaningless on a span and React would warn; convey the
      // state to assistive tech and block the pointer instead.
      {...(isButton ? { disabled: isDisabled } : { 'aria-disabled': isDisabled || undefined })}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        !isButton && isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        'active:scale-[0.97]',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </Component>
  );
});

Button.displayName = 'Button';
export default Button;
