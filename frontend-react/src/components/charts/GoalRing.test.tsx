import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoalRing } from './GoalRing'

describe('GoalRing', () => {
  it('renders an SVG', () => {
    const { container } = render(<GoalRing current={30} target={40} label="Weekly Goal" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('displays the percentage in the centre', () => {
    render(<GoalRing current={20} target={40} label="Goal" />)
    // 20/40 = 50%
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('displays the label text', () => {
    render(<GoalRing current={10} target={40} label="Weekly Goal" />)
    expect(screen.getByText('Weekly Goal')).toBeInTheDocument()
  })

  it('caps display at 100% when current exceeds target', () => {
    render(<GoalRing current={50} target={40} label="Goal" />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shows 0% when current is 0', () => {
    render(<GoalRing current={0} target={40} label="Goal" />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('renders two SVG circles (track + progress)', () => {
    const { container } = render(<GoalRing current={20} target={40} label="Goal" />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(2)
  })
})
