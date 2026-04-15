import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { HelpMessage } from '@/types/models'

// Reuse the same markdown component overrides from ChatBubble but scoped to widget size
const mdComponents: Components = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mb-1.5 pl-4 space-y-0.5 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="mb-1.5 pl-4 space-y-0.5 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="text-sm font-bold mb-1.5 mt-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-semibold mb-1 mt-1.5 first:mt-0">{children}</h3>,
  hr: () => <hr className="my-2" style={{ borderColor: 'var(--color-border-subtle)' }} />,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <code
          className="block rounded px-2 py-1.5 text-xs font-mono overflow-x-auto mb-1.5"
          style={{
            background: 'var(--color-bg-elevated)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded px-1 py-0.5 text-xs font-mono"
        style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--color-brand-secondary)' }}
      >
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div
      className="overflow-x-auto my-2 rounded"
      style={{ border: '1px solid var(--color-border-default)' }}
    >
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: 'rgba(99,102,241,0.15)', borderBottom: '1px solid rgba(99,102,241,0.3)' }}>
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-2 py-1.5 text-left font-semibold text-xs" style={{ color: '#a5b4fc' }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      className="px-2 py-1.5"
      style={{ color: 'var(--color-text-primary)', borderTop: '1px solid var(--color-border-subtle)' }}
    >
      {children}
    </td>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  blockquote: ({ children }) => (
    <blockquote
      className="pl-2.5 my-1.5 text-xs italic"
      style={{ borderLeft: '3px solid var(--color-brand-secondary)', color: 'var(--color-text-secondary)' }}
    >
      {children}
    </blockquote>
  ),
}

interface MessageProps {
  message: HelpMessage
}

export function Message({ message }: MessageProps) {
  const isAI = message.role === 'assistant'

  return (
    <div className={`flex items-end gap-2 mb-3 ${isAI ? '' : 'flex-row-reverse'}`}>
      {/* AI avatar */}
      {isAI && (
        <div
          className="w-5 h-5 rounded-full flex-shrink-0 self-start mt-0.5 flex items-center justify-center text-[9px] font-bold"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', color: '#fff' }}
        >
          AI
        </div>
      )}

      <div className={`flex flex-col gap-1 ${isAI ? 'items-start' : 'items-end'}`} style={{ maxWidth: '90%' }}>
        {/* Tool call pill */}
        {message.toolCall && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
            style={{
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#34d399',
            }}
          >
            ✓ {message.toolCall}
          </span>
        )}

        {/* Bubble */}
        <div
          className="px-3 py-2 text-xs leading-relaxed"
          style={
            isAI
              ? {
                  background: message.isError ? 'rgba(244,63,94,0.1)' : 'var(--color-bg-elevated)',
                  border: `1px solid ${message.isError ? 'rgba(244,63,94,0.3)' : 'rgba(139,92,246,0.25)'}`,
                  borderRadius: '4px 10px 10px 10px',
                  color: 'var(--color-text-primary)',
                }
              : {
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: '10px 4px 10px 10px',
                  color: 'var(--color-text-primary)',
                }
          }
        >
          {isAI ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
          ) : (
            <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    </div>
  )
}
