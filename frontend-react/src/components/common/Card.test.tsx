import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Card, InteractiveCard, MetricCard } from './Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  it('has border-radius and background classes', () => {
    const { container } = render(<Card>Content</Card>)
    const el = container.firstChild as HTMLElement
    expect(el.className).toMatch(/rounded|bg-/)
  })

  it('accepts className override', () => {
    const { container } = render(<Card className="my-custom">Content</Card>)
    expect((container.firstChild as HTMLElement).className).toContain('my-custom')
  })
})

describe('InteractiveCard', () => {
  it('renders children', () => {
    render(<InteractiveCard onClick={vi.fn()}>Click me</InteractiveCard>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('has pointer cursor class', () => {
    const { container } = render(<InteractiveCard onClick={vi.fn()}>Click me</InteractiveCard>)
    const el = container.firstChild as HTMLElement
    expect(el.className).toMatch(/cursor-pointer/)
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<InteractiveCard onClick={onClick}>Click me</InteractiveCard>)
    fireEvent.click(screen.getByText('Click me'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('MetricCard', () => {
  it('renders label', () => {
    render(<MetricCard label="Total Hours" value={42.5} />)
    expect(screen.getByText('Total Hours')).toBeInTheDocument()
  })

  it('renders value', () => {
    render(<MetricCard label="Total Hours" value={42.5} />)
    expect(screen.getByText('42.5')).toBeInTheDocument()
  })

  it('positive trend shows as green/emerald with upward indicator', () => {
    const { container } = render(<MetricCard label="Hours" value={100} trend={12} />)
    const trendEl = container.querySelector('[class*="emerald"], [class*="green"], [class*="success"]')
    expect(trendEl || container.querySelector('[class*="trend"]')).toBeTruthy()
    // upward indicator (could be ↑ or an icon)
    expect(container.textContent).toMatch(/12|↑|\+/)
  })

  it('negative trend shows as rose/red with downward indicator', () => {
    const { container } = render(<MetricCard label="Hours" value={80} trend={-5} />)
    const trendEl = container.querySelector('[class*="rose"], [class*="red"], [class*="danger"]')
    expect(trendEl || container.querySelector('[class*="trend"]')).toBeTruthy()
    expect(container.textContent).toMatch(/5|↓|-/)
  })

  it('renders without trend when trend prop is not provided', () => {
    render(<MetricCard label="Hours" value={50} />)
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
    expect(screen.getByText('Hours')).toBeInTheDocument()
  })

  it('renders an icon when icon prop provided', () => {
    const { container } = render(
      <MetricCard label="Hours" value={50} icon="clock" />
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('danger accent applies red/danger color to icon container', () => {
    const { container } = render(
      <MetricCard label="Blocked" value={2} accent="danger" icon="alert" />
    )
    // Collect all inline backgrounds; the icon container uses rgba(244,63,94,...)
    const allBgs = Array.from(container.querySelectorAll('[style]'))
      .map(el => (el as HTMLElement).style.background)
      .join(' ')
    expect(allBgs).toMatch(/244.*63.*94|rgba\(244/)
  })

  it('success accent applies green/success color to icon container', () => {
    const { container } = render(
      <MetricCard label="Done" value={10} accent="success" icon="chart" />
    )
    const allBgs = Array.from(container.querySelectorAll('[style]'))
      .map(el => (el as HTMLElement).style.background)
      .join(' ')
    expect(allBgs).toMatch(/16.*185.*129|rgba\(16/)
  })
})
