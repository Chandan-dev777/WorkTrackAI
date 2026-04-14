import { useEffect } from 'react'

export interface ShortcutOptions {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  /** Allow firing even when an input/textarea is focused. Default: false. */
  allowInInput?: boolean
}

/**
 * Registers a global keydown listener for a keyboard shortcut.
 * Does NOT fire when focus is inside an input or textarea unless `allowInInput` is true.
 * Cleans up the listener on unmount.
 */
export function useKeyboardShortcut(
  options: ShortcutOptions,
  callback: () => void
) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const { key, ctrl = false, meta = false, shift = false, allowInInput = false } = options

      // Modifier check
      if (ctrl  && !e.ctrlKey)  return
      if (meta  && !e.metaKey)  return
      if (shift && !e.shiftKey) return
      if (e.key.toLowerCase() !== key.toLowerCase()) return

      // Block when focused inside input/textarea
      if (!allowInInput) {
        const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea') return
      }

      e.preventDefault()
      callback()
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [options, callback])
}
