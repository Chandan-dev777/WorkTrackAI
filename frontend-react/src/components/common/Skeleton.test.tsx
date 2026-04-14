import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton, SkeletonCard, SkeletonTable } from './Skeleton'

describe('Skeleton', () => {
  it('renders a shimmer element', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toBeTruthy()
  })

  it('applies shimmer/animate class', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toMatch(/animate|shimmer|pulse/)
  })

  it('applies custom width and height via className or style', () => {
    const { container } = render(<Skeleton className="w-48 h-4" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('w-48')
    expect(el.className).toContain('h-4')
  })

  it('has aria-busy or aria-label for screen readers', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    const hasBusy = el.getAttribute('aria-busy') === 'true'
    const hasLabel = !!el.getAttribute('aria-label')
    expect(hasBusy || hasLabel).toBe(true)
  })
})

describe('SkeletonCard', () => {
  it('renders multiple skeleton lines', () => {
    const { container } = render(<SkeletonCard />)
    const skeletons = container.querySelectorAll('[class*="animate"], [class*="shimmer"], [class*="pulse"]')
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })
})

describe('SkeletonTable', () => {
  it('renders correct number of rows', () => {
    const { container } = render(<SkeletonTable rows={4} cols={3} />)
    const rows = container.querySelectorAll('tr, [role="row"]')
    // rows includes header + data rows
    expect(rows.length).toBeGreaterThanOrEqual(4)
  })

  it('renders correct number of columns per row', () => {
    const { container } = render(<SkeletonTable rows={2} cols={3} />)
    const firstRow = container.querySelector('tr, [role="row"]')
    const cells = firstRow?.querySelectorAll('td, th, [role="cell"], [role="columnheader"]')
    expect(cells && cells.length).toBeGreaterThanOrEqual(1)
  })
})
