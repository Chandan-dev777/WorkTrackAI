export function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4" aria-label="AI is typing">
      {/* AI avatar */}
      <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
        style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', color: '#fff' }}>
        AI
      </div>

      {/* Bubble with dots */}
      <div className="px-4 py-3 rounded-sm rounded-tr-xl rounded-br-xl rounded-bl-xl"
        style={{
          background: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: '4px 12px 12px 12px',
        }}>
        <div className="flex items-center gap-1.5 h-4">
          {[0, 160, 320].map((delay) => (
            <span
              key={delay}
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{
                background: 'var(--color-brand-secondary)',
                animation: `bounce-dot 1.2s infinite`,
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
