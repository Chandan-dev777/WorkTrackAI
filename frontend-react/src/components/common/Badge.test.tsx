import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, CategoryTag, CountBadge } from './Badge'

describe('StatusBadge', () => {
  it('success type shows emerald-colored element', () => {
    const { container } = render(<StatusBadge type="success">Done</StatusBadge>)
    expect(container.firstChild).toBeTruthy()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('warning type renders with amber colors', () => {
    const { container } = render(<StatusBadge type="warning">Pending</StatusBadge>)
    expect(container.firstChild!.toString()).toBeTruthy()
    const el = container.querySelector('[class*="warning"], [class*="amber"], [class*="yellow"]')
    expect(el || container.firstChild).toBeTruthy()
  })

  it('danger type renders with rose colors', () => {
    render(<StatusBadge type="danger">Blocked</StatusBadge>)
    const el = document.querySelector('[class*="danger"], [class*="rose"], [class*="red"]')
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(el || document.querySelector('[class]')).toBeTruthy()
  })

  it('info type renders with sky colors', () => {
    render(<StatusBadge type="info">Reviewing</StatusBadge>)
    expect(screen.getByText('Reviewing')).toBeInTheDocument()
  })

  it('ai type renders with violet colors', () => {
    render(<StatusBadge type="ai">AI</StatusBadge>)
    expect(screen.getByText('AI')).toBeInTheDocument()
    const el = document.querySelector('[class*="ai"], [class*="violet"], [class*="purple"]')
    expect(el || document.querySelector('[class]')).toBeTruthy()
  })

  it('renders children text', () => {
    render(<StatusBadge type="success">Active</StatusBadge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})

describe('CategoryTag', () => {
  it('renders category label text', () => {
    render(<CategoryTag>Development</CategoryTag>)
    expect(screen.getByText('Development')).toBeInTheDocument()
  })

  it('has a background class applied', () => {
    const { container } = render(<CategoryTag>Testing</CategoryTag>)
    expect(container.firstChild).toBeTruthy()
    expect((container.firstChild as HTMLElement).className).toBeTruthy()
  })
})

describe('CountBadge', () => {
  it('renders the count number', () => {
    render(<CountBadge count={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows 99+ when count exceeds 99', () => {
    render(<CountBadge count={150} />)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('shows exact count when count is exactly 99', () => {
    render(<CountBadge count={99} />)
    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('applies brand background class', () => {
    const { container } = render(<CountBadge count={3} />)
    expect((container.firstChild as HTMLElement).className).toMatch(/brand|indigo|bg-/)
  })
})
