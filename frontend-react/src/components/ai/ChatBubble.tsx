import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { Copy, RefreshCw, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useStreamingText } from '@/hooks/useStreamingText'
import type { SourceReference } from '@/api/chat'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  sources?: SourceReference[]
  isError?: boolean
  /** Stream the content character-by-character (only for the most recent AI message) */
  stream?: boolean
  onRetry?: () => void
}

// ── Markdown overrides ────────────────────────────────────────────────────────

const mdComponents: Components = {
  p:          ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong:     ({ children }) => <strong className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{children}</strong>,
  em:         ({ children }) => <em className="italic">{children}</em>,
  ul:         ({ children }) => <ul className="mb-2 pl-4 space-y-0.5 list-disc" style={{ color: 'inherit' }}>{children}</ul>,
  ol:         ({ children }) => <ol className="mb-2 pl-4 space-y-0.5 list-decimal" style={{ color: 'inherit' }}>{children}</ol>,
  li:         ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1:         ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
  h2:         ({ children }) => <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
  h3:         ({ children }) => <h3 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h3>,
  hr:         () => <hr className="my-3" style={{ borderColor: 'var(--color-border-subtle)' }} />,
  blockquote: ({ children }) => (
    <blockquote className="pl-3 my-2 text-sm italic"
      style={{ borderLeft: '3px solid var(--color-brand-secondary)', color: 'var(--color-text-secondary)' }}>
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return (
        <div className="relative group/code mb-2">
          <code className="block rounded-md px-3 py-2 text-xs font-mono overflow-x-auto"
            style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-subtle)' }}>
            {children}
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText(String(children)); toast.success('Code copied') }}
            className="absolute top-1.5 right-1.5 opacity-0 group-hover/code:opacity-100 transition-opacity rounded px-1.5 py-0.5 text-xs"
            style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-secondary)' }}>
            Copy
          </button>
        </div>
      )
    }
    return (
      <code className="rounded px-1 py-0.5 text-xs font-mono"
        style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--color-brand-secondary)' }}>
        {children}
      </code>
    )
  },
  table:  ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-lg" style={{ border: '1px solid var(--color-border-default)' }}>
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead:  ({ children }) => <thead style={{ background: 'rgba(99,102,241,0.18)', borderBottom: '2px solid rgba(99,102,241,0.35)' }}>{children}</thead>,
  th:     ({ children }) => <th className="px-3 py-2.5 text-left font-semibold text-xs tracking-wide" style={{ color: '#a5b4fc' }}>{children}</th>,
  td:     ({ children }) => <td className="px-3 py-2" style={{ color: 'var(--color-text-primary)', borderTop: '1px solid var(--color-border-subtle)' }}>{children}</td>,
  tbody:  ({ children }) => <tbody>{children}</tbody>,
  tr:     ({ children }) => (
    <tr className="transition-colors" style={{ background: 'rgba(0,0,0,0)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}>
      {children}
    </tr>
  ),
}

// ── Source chip (expandable) ──────────────────────────────────────────────────

function SourceChip({ src }: { src: SourceReference }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all"
        style={{
          background: expanded ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(139,92,246,0.25)',
          color: 'var(--color-brand-secondary)',
        }}
      >
        📎 {src.work_date} — {src.task_description.slice(0, 28)}{src.task_description.length > 28 ? '…' : ''}
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {expanded && (
        <div className="mt-1.5 rounded-md px-3 py-2 text-xs"
          style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)', color: 'var(--color-text-secondary)' }}>
          <p className="font-medium mb-0.5" style={{ color: 'var(--color-text-primary)' }}>{src.task_description}</p>
          <p style={{ color: 'var(--color-text-muted)' }}>{src.work_date}</p>
        </div>
      )}
    </div>
  )
}

// ── Hover action bar ─────────────────────────────────────────────────────────

function ActionBar({ content, onRetry, sourcesCount }: { content: string; onRetry?: () => void; sourcesCount: number }) {
  const [liked, setLiked] = useState<boolean | null>(null)
  return (
    <div className="flex items-center gap-1 mt-1" role="toolbar" aria-label="Message actions">
      <button
        onClick={() => { navigator.clipboard.writeText(content); toast.success('Copied to clipboard') }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
        style={{ color: 'var(--color-text-muted)', background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-elevated)'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
      >
        <Copy size={11} /> Copy
      </button>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
          style={{ color: 'var(--color-text-muted)', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-elevated)'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)' }}
        >
          <RefreshCw size={11} /> Retry
        </button>
      )}
      {sourcesCount > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
          style={{ color: 'var(--color-text-muted)' }}
          title="Sources shown below">
          <ExternalLink size={11} /> {sourcesCount} source{sourcesCount !== 1 ? 's' : ''}
        </span>
      )}
      <div style={{ marginLeft: 4, display: 'flex', gap: 2 }}>
        <button onClick={() => setLiked(true)} title="Helpful"
          style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: liked === true ? 'rgba(16,185,129,0.15)' : 'transparent', color: liked === true ? '#10B981' : 'var(--color-text-muted)', cursor: 'pointer', fontSize: 11 }}>
          <ThumbsUp size={11} />
        </button>
        <button onClick={() => setLiked(false)} title="Not helpful"
          style={{ padding: '2px 6px', borderRadius: 4, border: 'none', background: liked === false ? 'rgba(244,63,94,0.15)' : 'transparent', color: liked === false ? '#F43F5E' : 'var(--color-text-muted)', cursor: 'pointer', fontSize: 11 }}>
          <ThumbsDown size={11} />
        </button>
      </div>
    </div>
  )
}

// ── ChatBubble ────────────────────────────────────────────────────────────────

export function ChatBubble({ role, content, sources, isError, stream = false, onRetry }: ChatBubbleProps) {
  const isAI = role === 'assistant'
  const { displayed, isDone } = useStreamingText(content, isAI && stream)
  const renderedContent = (isAI && stream) ? displayed : content
  const showCursor = isAI && stream && !isDone

  return (
    <div className={`flex items-end gap-3 mb-4 ${isAI ? '' : 'flex-row-reverse'}`}>
      {/* AI avatar */}
      {isAI && (
        <div className="w-7 h-7 rounded-full flex-shrink-0 self-start mt-1 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', color: '#fff', boxShadow: '0 0 0 2px rgba(139,92,246,0.2)' }}>
          <span style={{ fontSize: 12 }}>✦</span>
        </div>
      )}

      <div className={`flex flex-col gap-1 ${isAI ? 'items-start' : 'items-end'}`} style={{ maxWidth: '88%' }}>
        {/* Bubble */}
        <div className="px-4 py-3 text-sm"
          style={isAI ? {
            background: isError ? 'rgba(244,63,94,0.1)' : 'var(--color-bg-elevated)',
            border: `1px solid ${isError ? 'rgba(244,63,94,0.3)' : 'rgba(139,92,246,0.25)'}`,
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
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {renderedContent}
              </ReactMarkdown>
              {showCursor && (
                <span style={{ display: 'inline-block', width: 2, height: 14, background: 'var(--color-brand-primary)', marginLeft: 1, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />
              )}
            </>
          ) : (
            <p className="leading-relaxed">{content}</p>
          )}
        </div>

        {/* Source chips */}
        {isAI && sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Sources">
            {sources.map((src, i) => (
              <SourceChip key={src.work_item_id ?? i} src={src} />
            ))}
          </div>
        )}

        {/* Hover action bar — always visible for AI messages */}
        {isAI && !isError && (
          <ActionBar content={content} onRetry={onRetry} sourcesCount={sources?.length ?? 0} />
        )}
      </div>
    </div>
  )
}
