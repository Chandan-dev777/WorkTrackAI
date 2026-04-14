import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { SourceReference } from '@/api/chat'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  sources?: SourceReference[]
  isError?: boolean
}

// ── Markdown component overrides (dark-theme styled) ─────────────────────────

const mdComponents: Components = {
  // Paragraphs
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  // Bold
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{children}</strong>
  ),
  // Italic
  em: ({ children }) => <em className="italic">{children}</em>,
  // Unordered list
  ul: ({ children }) => (
    <ul className="mb-2 pl-4 space-y-0.5 list-disc" style={{ color: 'inherit' }}>{children}</ul>
  ),
  // Ordered list
  ol: ({ children }) => (
    <ol className="mb-2 pl-4 space-y-0.5 list-decimal" style={{ color: 'inherit' }}>{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  // Headings
  h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h3>,
  // Horizontal rule
  hr: () => <hr className="my-3" style={{ borderColor: 'var(--color-border-subtle)' }} />,
  // Inline code
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code className="block rounded-md px-3 py-2 text-xs font-mono overflow-x-auto mb-2"
          style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-subtle)' }}>
          {children}
        </code>
      )
    }
    return (
      <code className="rounded px-1 py-0.5 text-xs font-mono"
        style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--color-brand-secondary)' }}>
        {children}
      </code>
    )
  },
  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-xs border-collapse rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--color-border-subtle)' }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: 'var(--color-bg-elevated)' }}>{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-medium uppercase tracking-wide text-xs"
      style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-default)' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2"
      style={{ color: 'var(--color-text-primary)', borderTop: '1px solid var(--color-border-subtle)' }}>
      {children}
    </td>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="transition-colors hover:bg-[var(--color-bg-elevated)]">{children}</tr>
  ),
  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="pl-3 my-2 text-sm italic"
      style={{ borderLeft: '3px solid var(--color-brand-secondary)', color: 'var(--color-text-secondary)' }}>
      {children}
    </blockquote>
  ),
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatBubble({ role, content, sources, isError }: ChatBubbleProps) {
  const isAI = role === 'assistant'

  return (
    <div className={`flex items-end gap-3 mb-4 ${isAI ? '' : 'flex-row-reverse'}`}>
      {/* AI avatar */}
      {isAI && (
        <div className="w-6 h-6 rounded-full flex-shrink-0 self-start mt-1 flex items-center justify-center text-xs font-bold"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', color: '#fff' }}>
          AI
        </div>
      )}

      <div className={`flex flex-col gap-1.5 ${isAI ? 'items-start' : 'items-end'}`} style={{ maxWidth: '88%' }}>
        {/* Message bubble */}
        <div
          className="px-4 py-3 text-sm"
          style={isAI ? {
            background: isError ? 'rgba(244,63,94,0.08)' : 'rgba(139,92,246,0.06)',
            border: `1px solid ${isError ? 'rgba(244,63,94,0.2)' : 'rgba(139,92,246,0.18)'}`,
            borderRadius: '4px 12px 12px 12px',
            color: 'var(--color-text-primary)',
          } : {
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '12px 4px 12px 12px',
            color: 'var(--color-text-primary)',
          }}
        >
          {isAI ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {content}
            </ReactMarkdown>
          ) : (
            <p className="leading-relaxed">{content}</p>
          )}
        </div>

        {/* Source chips */}
        {isAI && sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Sources">
            {sources.map((src) => (
              <span
                key={src.work_item_id}
                title={src.task_description}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs cursor-default"
                style={{
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  color: 'var(--color-brand-secondary)',
                }}
              >
                📎 {src.work_date} — {src.task_description.slice(0, 30)}{src.task_description.length > 30 ? '…' : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
