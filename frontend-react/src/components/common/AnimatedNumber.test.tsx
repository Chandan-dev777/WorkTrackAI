import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnimatedNumber } from './AnimatedNumber'

describe('AnimatedNumber', () => {
  it('renders the target value immediately when duration=0', () => {
    render(<AnimatedNumber value={42.5} duration={0} />)
    expect(screen.getByText('42.5')).toBeInTheDocument()
  })

  it('renders integer values without decimal point when whole number', () => {
    render(<AnimatedNumber value={10} duration={0} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders with suffix', () => {
    render(<AnimatedNumber value={32.5} duration={0} suffix="h" />)
    expect(screen.getByText('32.5h')).toBeInTheDocument()
  })

  it('renders 0 correctly', () => {
    render(<AnimatedNumber value={0} duration={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('renders with decimals prop controlling precision', () => {
    render(<AnimatedNumber value={42.123} duration={0} decimals={1} />)
    expect(screen.getByText('42.1')).toBeInTheDocument()
  })

  it('renders without suffix by default', () => {
    render(<AnimatedNumber value={5} duration={0} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.queryByText('5h')).not.toBeInTheDocument()
  })
})
