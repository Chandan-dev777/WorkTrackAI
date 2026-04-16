import { motion } from 'framer-motion'

// ── Animation variants ────────────────────────────────────────────────────────

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } },
}

// ── Components ────────────────────────────────────────────────────────────────

export interface StaggerListProps {
  children: React.ReactNode
  className?: string
  /** Override the stagger delay between children (default 50ms) */
  staggerMs?: number
}

/**
 * Wraps a list in a Framer Motion container that staggers child entry animations.
 * Pair with `<StaggerItem>` for each child that should animate independently.
 */
export function StaggerList({ children, className, staggerMs = 50 }: StaggerListProps) {
  const variants = {
    hidden: {},
    show: { transition: { staggerChildren: staggerMs / 1000 } },
  }

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export interface StaggerItemProps {
  children: React.ReactNode
  className?: string
}

/**
 * A single animated item inside a `<StaggerList>`.
 * Slides in from the left with a fade — stagger timing is controlled by the parent.
 */
export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  )
}
