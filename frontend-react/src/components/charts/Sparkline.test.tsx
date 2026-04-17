import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from './Sparkline'

describe('Sparkline', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 4, 5]} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a polyline inside the SVG', () => {
    const { container } = render(<Sparkline data={[1, 3, 2, 5, 4]} />)
    expect(container.querySelector('polyline')).toBeTruthy()
  })

  it('renders nothing when data is empty', () => {
    const { container } = render(<Sparkline data={[]} />)
    expect(container.querySelector('polyline')).toBeFalsy()
  })

  it('renders a single point without crashing', () => {
    const { container } = render(<Sparkline data={[5]} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('applies custom width and height', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} width={120} height={30} />)
    const svg = container.querySelector('svg') as SVGElement
    expect(svg.getAttribute('width')).toBe('120')
    expect(svg.getAttribute('height')).toBe('30')
  })

  it('polyline has stroke colour', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} color="#6366F1" />)
    const line = container.querySelector('polyline') as SVGPolylineElement
    expect(line.getAttribute('stroke')).toBe('#6366F1')
  })
})
