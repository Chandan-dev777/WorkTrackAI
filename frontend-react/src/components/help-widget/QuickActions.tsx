interface QuickAction {
  label: string
  message: string
  prefill?: boolean  // true = just prefill the input, false = send immediately
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: '💬 Give Feedback',        message: 'I have some feedback: ',          prefill: true },
  { label: '🐛 Report a Bug',         message: 'I want to report a bug: ',        prefill: true },
  { label: '✨ Add Requirement',       message: 'Add a requirement: ',             prefill: true },
  { label: '📤 How to submit update',  message: 'How do I submit a work update?', prefill: false },
  { label: '👥 Roles & permissions',   message: 'What can managers see that employees cannot?', prefill: false },
  { label: '📊 What do charts mean',   message: 'What does the confidence score column mean on My Dashboard?', prefill: false },
]

interface QuickActionsProps {
  onAction: (message: string, send: boolean) => void
}

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <div className="px-3 py-2">
      <p
        className="text-[10px] font-medium mb-2 uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Quick questions
      </p>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => onAction(action.message, !action.prefill)}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: 'var(--color-brand-subtle)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: 'var(--color-brand-secondary)',
              cursor: 'pointer',
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
