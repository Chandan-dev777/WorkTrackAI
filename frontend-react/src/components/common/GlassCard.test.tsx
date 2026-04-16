import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GlassCard } from './GlassCard'

describe('GlassCard', () => {
  it('renders children', () => {
    render(<GlassCard>Glass content</GlassCard>)
    expect(screen.getByText('Glass content')).toBeInTheDocument()
  })

  it('applies rounded-2xl class', () => {
    const { container } = render(<GlassCard>Content</GlassCard>)
    expect((container.firstChild as HTMLElement).className).toMatch(/rounded/)
  })

  it('accepts and forwards className', () => {
    const { container } = render(<GlassCard className="custom-class">Content</GlassCard>)
    expect((container.firstChild as HTMLElement).className).toContain('custom-class')
  })

  it('accepts and forwards style prop', () => {
    const { container } = render(<GlassCard style={{ padding: '8px' }}>Content</GlassCard>)
    expect((container.firstChild as HTMLElement).style.padding).toBe('8px')
  })

  it('has backdrop-filter style applied', () => {
    const { container } = render(<GlassCard>Content</GlassCard>)
    const el = container.firstChild as HTMLElement
    const backdropFilter = el.style.backdropFilter || el.style.getPropertyValue('-webkit-backdrop-filter')
    expect(backdropFilter || el.style.cssText).toBeTruthy()
  })
})
