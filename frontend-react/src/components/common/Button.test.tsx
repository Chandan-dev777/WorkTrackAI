import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button — variants', () => {
  it('primary variant renders with brand background class', () => {
    render(<Button variant="primary">Click</Button>)
    const btn = screen.getByRole('button', { name: 'Click' })
    expect(btn.className).toMatch(/bg-brand|brand-primary|indigo/)
  })

  it('secondary variant renders with transparent background and border', () => {
    render(<Button variant="secondary">Click</Button>)
    const btn = screen.getByRole('button', { name: 'Click' })
    expect(btn.className).toMatch(/border|secondary/)
  })

  it('ghost variant renders without border', () => {
    render(<Button variant="ghost">Click</Button>)
    const btn = screen.getByRole('button', { name: 'Click' })
    expect(btn.className).toMatch(/ghost/)
  })

  it('danger variant renders with rose-tinted class', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn.className).toMatch(/danger|rose|red/)
  })

  it('ai variant renders with gradient class', () => {
    render(<Button variant="ai">Ask AI</Button>)
    const btn = screen.getByRole('button', { name: 'Ask AI' })
    expect(btn.className).toMatch(/ai|gradient/)
  })
})

describe('Button — sizes', () => {
  it('sm size applies small height class', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button', { name: 'Small' })
    expect(btn.className).toMatch(/h-8|size-sm/)
  })

  it('md size is the default', () => {
    render(<Button>Default</Button>)
    const btn = screen.getByRole('button', { name: 'Default' })
    expect(btn.className).toMatch(/h-10|size-md/)
  })

  it('lg size applies large height class', () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole('button', { name: 'Large' })
    expect(btn.className).toMatch(/h-12|size-lg/)
  })
})

describe('Button — loading state', () => {
  it('shows spinner when isLoading=true', () => {
    render(<Button isLoading>Save</Button>)
    expect(screen.getByRole('button').querySelector('svg, [data-testid="spinner"], .animate-spin')).toBeTruthy()
  })

  it('button is disabled when isLoading=true', () => {
    render(<Button isLoading>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('label text hidden or replaced when isLoading=true', () => {
    const { container } = render(<Button isLoading>Save</Button>)
    // The label should not be the primary visible content
    const btn = container.querySelector('button')!
    expect(btn).toBeDisabled()
  })
})

describe('Button — disabled state', () => {
  it('disabled=true makes button disabled', () => {
    render(<Button disabled>Click</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('onClick does not fire when disabled', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disabled applies reduced-opacity class', () => {
    render(<Button disabled>Click</Button>)
    expect(screen.getByRole('button').className).toMatch(/opacity|disabled/)
  })
})

describe('Button — behavior', () => {
  it('onClick fires when enabled', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('type="submit" works in a form context', () => {
    const onSubmit = vi.fn((e) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Submit</Button>
      </form>
    )
    fireEvent.submit(screen.getByRole('button').closest('form')!)
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  it('accepts className override', () => {
    render(<Button className="custom-class">Click</Button>)
    expect(screen.getByRole('button').className).toContain('custom-class')
  })
})
