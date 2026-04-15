import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, MessageCircle, FileText, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { assistantApi } from '@/api/assistant'
import { useAuthStore } from '@/store/authStore'
import { ChatTab } from './ChatTab'
import { NotesTab } from './NotesTab'
import type { HelpMessage } from '@/types/models'

type Tab = 'chat' | 'notes'

const WELCOME: HelpMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm your WorkTrack AI helper. I can explain features, walk you through workflows, " +
    'and save bug reports or requirements for you.\n\n' +
    'For questions about **your logged work or hours**, use the **Chat Assistant** page instead.',
}

export function HelpWidget() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('chat')

  // ── Conversation state lives here so it survives panel open/close ──────────
  const [messages, setMessages] = useState<HelpMessage[]>([WELCOME])

  const clearChat = () => setMessages([WELCOME])

  // Count open notes for badge
  const { data: openNotes = [] } = useQuery({
    queryKey: ['assistant-notes', '', 'open'],
    queryFn: () => assistantApi.listNotes({ status: 'open' }),
    enabled: isAuthenticated,
    refetchInterval: open ? false : 60_000,
  })

  if (!isAuthenticated) return null

  const badgeCount = openNotes.length

  return (
    <>
      {/* Floating bubble */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close help assistant' : 'Open help assistant'}
        className="fixed bottom-6 right-6 z-[9998] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
        style={{ background: 'var(--gradient-ai)' }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="close"
              initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={22} color="#fff" />
            </motion.span>
          ) : (
            <motion.span key="open"
              initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle size={22} color="#fff" />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Badge — open note count */}
        {!open && badgeCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ background: '#f43f5e', color: '#fff' }}
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </motion.button>

      {/* Chat panel — always rendered when open (AnimatePresence handles enter/exit).
          Messages state lives in HelpWidget above, so it's never lost on close. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed bottom-24 right-6 z-[9997] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{
              width: '380px',
              height: '580px',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1)',
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ background: 'var(--gradient-ai)', minHeight: '52px' }}
            >
              <div className="flex items-center gap-2">
                <MessageCircle size={16} color="rgba(255,255,255,0.9)" />
                <span className="text-sm font-semibold text-white">WorkTrack AI Help</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Tab switcher */}
                <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  {(['chat', 'notes'] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className="flex items-center gap-1 px-3 py-1 text-[11px] font-medium transition-all duration-150"
                      style={{
                        color: 'rgba(255,255,255,0.95)',
                        background: tab === t ? 'rgba(255,255,255,0.25)' : 'transparent',
                      }}
                    >
                      {t === 'chat' ? (
                        <><MessageCircle size={11} /> Chat</>
                      ) : (
                        <>
                          <FileText size={11} />
                          Notes
                          {badgeCount > 0 && (
                            <span
                              className="ml-0.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold"
                              style={{ background: '#f43f5e', color: '#fff' }}
                            >
                              {badgeCount > 9 ? '9+' : badgeCount}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  ))}
                </div>

                {/* Clear chat button — only visible on chat tab */}
                {tab === 'chat' && messages.length > 1 && (
                  <button
                    onClick={clearChat}
                    title="Clear conversation"
                    className="p-1.5 rounded-lg transition-all duration-150 hover:bg-[rgba(255,255,255,0.2)]"
                    aria-label="Clear conversation"
                  >
                    <Trash2 size={13} color="rgba(255,255,255,0.85)" />
                  </button>
                )}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {tab === 'chat'
                ? <ChatTab messages={messages} setMessages={setMessages} />
                : <NotesTab />
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
