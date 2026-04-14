import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand border-transparent text-white hover:opacity-90 active:scale-[0.97]',
  secondary: 'bg-transparent border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:border-[var(--color-brand-primary)] hover:bg-[rgba(99,102,241,0.1)] active:scale-[0.97]',
  ghost: 'ghost bg-transparent border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)] active:scale-[0.97]',
  danger: 'danger bg-[rgba(244,63,94,0.12)] border border-[rgba(244,63,94,0.3)] text-rose-400 hover:bg-[rgba(244,63,94,0.2)] active:scale-[0.97]',
  ai: 'ai border-transparent text-white active:scale-[0.97]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'size-sm h-8 px-3 text-xs',
  md: 'size-md h-10 px-4 text-sm',
  lg: 'size-lg h-12 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      icon,
      iconPosition = 'left',
      className,
      children,
      style,
      ...props
    },
    ref
  ) {
    const isAI = variant === 'ai'

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] focus-visible:ring-offset-2',
          variantClasses[variant],
          sizeClasses[size],
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        style={
          isAI
            ? {
                background: 'var(--gradient-ai)',
                boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
                ...style,
              }
            : variant === 'primary'
            ? {
                background: 'var(--gradient-brand)',
                ...style,
              }
            : style
        }
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin"
              width={size === 'sm' ? 14 : size === 'lg' ? 18 : 16}
              height={size === 'sm' ? 14 : size === 'lg' ? 18 : 16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
            <span className="sr-only">Loading</span>
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && icon}
            {children}
            {icon && iconPosition === 'right' && icon}
          </>
        )}
      </button>
    )
  }
)
