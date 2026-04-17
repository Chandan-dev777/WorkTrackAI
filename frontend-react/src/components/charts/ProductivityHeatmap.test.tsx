import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductivityHeatmap } from './ProductivityHeatmap'

const mockData = [
  { date: '2026-04-14', count: 6 },
  { date: '2026-04-13', count: 4 },
  { date: '2026-04-10', count: 8 },
]

describe('ProductivityHeatmap', () => {
  it('renders a container element', () => {
    const { container } = render(<ProductivityHeatmap data={mockData} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders an accessible label or title', () => {
    render(<ProductivityHeatmap data={mockData} />)
    // Should have an aria-label or heading describing the heatmap
    const el = screen.queryByLabelText(/heatmap|activity|contribution/i)
      || screen.queryByText(/activity|contribution|heatmap/i)
    expect(el).toBeTruthy()
  })

  it('renders with empty data without crashing', () => {
    const { container } = render(<ProductivityHeatmap data={[]} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('accepts a custom weeks prop', () => {
    const { container } = render(<ProductivityHeatmap data={mockData} weeks={8} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('renders SVG cells for known dates', () => {
    const { container } = render(<ProductivityHeatmap data={mockData} weeks={4} />)
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(0)
  })
})
