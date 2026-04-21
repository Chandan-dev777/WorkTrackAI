import { motion } from 'framer-motion'

// ── Animation variants ────────────────────────────────────────────────────────

export const staggerItemVariants = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
}

// Supported container elements
const CONTAINER: Record<string, React.ElementType> = {
  div:   motion.div,
  tbody: motion.tbody,
  ul:    motion.ul,
  ol:    motion.ol,
}

// Supported item elements
const ITEM: Record<string, React.ElementType> = {
  div: motion.div,
  tr:  motion.tr,
  li:  motion.li,
}

// ── StaggerList ────────────────────────────────────────────────────────────────

export interface StaggerListProps {
  children: React.ReactNode
  className?: string
  /** HTML element to render as — default 'div'. Use 'tbody' for tables. */
  as?: 'div' | 'tbody' | 'ul' | 'ol'
  /** Stagger delay between children in ms (default 50) */
  staggerMs?: number
}

/**
 * Framer Motion stagger container.
 * Pair with `<StaggerItem>` for each animated child.
 * Supports `as="tbody"` for use inside `<table>`.
 */
export function StaggerList({ children, className, as = 'div', staggerMs = 50 }: StaggerListProps) {
  const Component = CONTAINER[as] ?? motion.div
  const variants = {
    hidden: {},
    show: { transition: { staggerChildren: staggerMs / 1000 } },
  }

  return (
    <Component
      variants={variants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </Component>
  )
}

// ── StaggerItem ────────────────────────────────────────────────────────────────

export interface StaggerItemProps {
  children: React.ReactNode
  className?: string
  /** HTML element to render as — default 'div'. Use 'tr' for table rows. */
  as?: 'div' | 'tr' | 'li'
  /** Additional HTML props forwarded to the rendered element */
  [key: string]: unknown
}

/**
 * A single animated item inside `<StaggerList>`.
 * Supports `as="tr"` for use inside a stagger table body.
 */
export function StaggerItem({ children, className, as = 'div', ...rest }: StaggerItemProps) {
  const Component = ITEM[as] ?? motion.div

  return (
    <Component variants={staggerItemVariants} className={className} {...rest}>
      {children}
    </Component>
  )
}
