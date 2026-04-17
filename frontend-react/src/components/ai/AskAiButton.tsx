import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

export interface AskAiButtonProps {
  /** Pre-filled question that will be opened in /chat */
  question: string
  className?: string
}

/**
 * Small "✦ Ask AI" button placed on chart/table section headings.
 * On click: navigates to /chat with the question pre-loaded via URL state.
 */
export function AskAiButton({ question, className }: AskAiButtonProps) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => navigate('/chat', { state: { prefillQuestion: question } })}
      title={`Ask AI: ${question}`}
      aria-label={`Ask AI: ${question}`}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--color-brand-secondary)',
        background: 'rgba(139,92,246,0.10)',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: 6,
        padding: '3px 10px',
        cursor: 'pointer',
        transition: 'background 150ms, border-color 150ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(139,92,246,0.20)'
        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(139,92,246,0.10)'
        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'
      }}
    >
      <Sparkles size={10} />
      Ask AI
    </button>
  )
}
