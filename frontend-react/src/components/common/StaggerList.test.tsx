import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StaggerList, StaggerItem } from './StaggerList'

describe('StaggerList', () => {
  it('renders children', () => {
    render(
      <StaggerList>
        <StaggerItem><p>Item one</p></StaggerItem>
        <StaggerItem><p>Item two</p></StaggerItem>
      </StaggerList>
    )
    expect(screen.getByText('Item one')).toBeInTheDocument()
    expect(screen.getByText('Item two')).toBeInTheDocument()
  })

  it('renders all children without omission', () => {
    render(
      <StaggerList>
        {['A', 'B', 'C'].map(t => <StaggerItem key={t}><span>{t}</span></StaggerItem>)}
      </StaggerList>
    )
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('accepts className on StaggerList', () => {
    const { container } = render(<StaggerList className="my-list"><StaggerItem><span>x</span></StaggerItem></StaggerList>)
    // The motion wrapper should carry the class
    expect(container.innerHTML).toContain('my-list')
  })

  it('StaggerItem renders its children', () => {
    render(<StaggerItem><button>Click</button></StaggerItem>)
    expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument()
  })
})
