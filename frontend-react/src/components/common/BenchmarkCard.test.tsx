import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BenchmarkCard } from './BenchmarkCard'

describe('BenchmarkCard', () => {
  it('renders the label', () => {
    render(<BenchmarkCard label="Hours" you={32} average={28} unit="h" />)
    expect(screen.getByText('Hours')).toBeInTheDocument()
  })

  it('renders your value with unit', () => {
    render(<BenchmarkCard label="Hours" you={32} average={28} unit="h" />)
    expect(screen.getByText('32h')).toBeInTheDocument()
  })

  it('renders average value with unit', () => {
    render(<BenchmarkCard label="Hours" you={32} average={28} unit="h" />)
    expect(screen.getByText('28h')).toBeInTheDocument()
  })

  it('shows positive delta when you > average', () => {
    render(<BenchmarkCard label="Hours" you={32} average={28} unit="h" />)
    // delta = +14.3% rounded
    const delta = screen.getByTestId('benchmark-delta')
    expect(delta.textContent).toMatch(/\+|\↑/)
  })

  it('shows negative delta when you < average', () => {
    render(<BenchmarkCard label="Hours" you={20} average={28} unit="h" />)
    const delta = screen.getByTestId('benchmark-delta')
    expect(delta.textContent).toMatch(/-|\↓/)
  })

  it('shows neutral state when equal', () => {
    render(<BenchmarkCard label="Hours" you={28} average={28} unit="h" />)
    const delta = screen.getByTestId('benchmark-delta')
    expect(delta).toBeInTheDocument()
  })

  it('renders "You" and "Avg" labels', () => {
    render(<BenchmarkCard label="Hours" you={32} average={28} unit="h" />)
    expect(screen.getByText(/you/i)).toBeInTheDocument()
    expect(screen.getByText(/avg/i)).toBeInTheDocument()
  })
})
