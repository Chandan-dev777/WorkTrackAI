import { useRef, useEffect, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'

interface MessageInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({ value, onChange, onSend, disabled, placeholder }: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [value])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSend()
    }
  }

  return (
    <div
      className="flex items-end gap-2 px-3 py-2.5"
      style={{ borderTop: '1px solid var(--color-border-subtle)' }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? 'Ask anything about DailyOps AI…'}
        rows={1}
        className="flex-1 resize-none rounded-lg px-3 py-2 text-xs leading-relaxed outline-none transition-colors"
        style={{
          background: 'var(--color-bg-base)',
          border: '1px solid var(--color-border-default)',
          color: 'var(--color-text-primary)',
          minHeight: '36px',
          maxHeight: '120px',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-brand-primary)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'var(--gradient-brand)' }}
        aria-label="Send message"
      >
        <Send size={14} color="#fff" />
      </button>
    </div>
  )
}
