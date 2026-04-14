import { forwardRef, useState, useId } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { label, error, helperText, type = 'text', maxLength, className, id, onChange, ...props },
    ref
  ) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const [showPwd, setShowPwd] = useState(false)
    const [charCount, setCharCount] = useState(0)

    const isPassword = type === 'password'
    const effectiveType = isPassword ? (showPwd ? 'text' : 'password') : type

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      setCharCount(e.target.value.length)
      onChange?.(e)
    }

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            maxLength={maxLength}
            onChange={handleChange}
            className={cn(
              'w-full h-10 px-3 rounded-md text-sm outline-none transition-all duration-150',
              'border focus:ring-0',
              error
                ? 'error border-rose-500 focus:border-rose-500 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.15)]'
                : 'border-[var(--color-border-default)] focus:border-[var(--color-brand-primary)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]',
              isPassword && 'pr-10',
              props.disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-primary)',
            }}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? 'Hide' : 'Show'}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>

        <div className="flex justify-between items-start">
          <div>
            {error && (
              <p className="text-xs" style={{ color: 'var(--color-status-danger)' }}>
                {error}
              </p>
            )}
            {!error && helperText && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {helperText}
              </p>
            )}
          </div>
          {maxLength !== undefined && (
            <p className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
              {charCount} / {maxLength}
            </p>
          )}
        </div>
      </div>
    )
  }
)
