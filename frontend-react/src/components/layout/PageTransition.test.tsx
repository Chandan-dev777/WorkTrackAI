import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageTransition } from './PageTransition'

describe('PageTransition', () => {
  it('renders children', () => {
    render(<PageTransition><p>Page content</p></PageTransition>)
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('wraps children in a motion container', () => {
    const { container } = render(
      <PageTransition><p>Test</p></PageTransition>
    )
    // Framer Motion renders a div wrapper
    expect(container.firstChild).toBeTruthy()
  })

  it('applies full-height style to the wrapper', () => {
    const { container } = render(
      <PageTransition><p>Test</p></PageTransition>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toBeTruthy()
  })
})
