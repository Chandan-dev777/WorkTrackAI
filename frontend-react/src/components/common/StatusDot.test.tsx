import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatusDot } from './StatusDot'

describe('StatusDot', () => {
  it('renders a visible dot element', () => {
    const { container } = render(<StatusDot status="done" />)
    expect(container.firstChild).toBeTruthy()
  })

  it('sets data-status attribute for each status', () => {
    const statuses = ['done', 'blocked', 'in_progress', 'planned'] as const
    for (const status of statuses) {
      const { container } = render(<StatusDot status={status} />)
      expect((container.firstChild as HTMLElement).dataset.status).toBe(status)
    }
  })

  it('done status dot has green colour (rgb 16,185,129)', () => {
    const { container } = render(<StatusDot status="done" />)
    const el = container.firstChild as HTMLElement
    // jsdom normalises hex to rgb — check for either form
    const bg = el.style.background || el.style.backgroundColor
    expect(bg).toMatch(/rgb\(16,\s*185,\s*129\)|#10B981/i)
  })

  it('blocked status dot has red colour (rgb 244,63,94)', () => {
    const { container } = render(<StatusDot status="blocked" />)
    const el = container.firstChild as HTMLElement
    const bg = el.style.background || el.style.backgroundColor
    expect(bg).toMatch(/rgb\(244,\s*63,\s*94\)|#F43F5E/i)
  })

  it('in_progress status dot has blue colour (rgb 14,165,233)', () => {
    const { container } = render(<StatusDot status="in_progress" />)
    const el = container.firstChild as HTMLElement
    const bg = el.style.background || el.style.backgroundColor
    expect(bg).toMatch(/rgb\(14,\s*165,\s*233\)|#0EA5E9/i)
  })

  it('planned status dot has muted colour', () => {
    const { container } = render(<StatusDot status="planned" />)
    const el = container.firstChild as HTMLElement
    const bg = el.style.background || el.style.backgroundColor
    expect(bg).toBeTruthy()
  })

  it('defaults to 8px size', () => {
    const { container } = render(<StatusDot status="done" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('8px')
    expect(el.style.height).toBe('8px')
  })

  it('accepts custom size prop', () => {
    const { container } = render(<StatusDot status="done" size={12} />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('12px')
    expect(el.style.height).toBe('12px')
  })
})
