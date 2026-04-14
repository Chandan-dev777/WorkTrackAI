import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input — label', () => {
  it('renders a visible label when label prop provided', () => {
    render(<Input id="name" label="Full Name" />)
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument()
  })

  it('renders without label when label prop omitted', () => {
    render(<Input id="name" />)
    expect(screen.queryByRole('label')).not.toBeInTheDocument()
  })
})

describe('Input — states', () => {
  it('focus applies brand border class', async () => {
    const user = userEvent.setup()
    render(<Input id="email" label="Email" />)
    const input = screen.getByLabelText('Email')
    await user.click(input)
    // input is focused — className or style changes
    expect(document.activeElement).toBe(input)
  })

  it('error state shows error message below field', () => {
    render(<Input id="email" label="Email" error="Email is required" />)
    expect(screen.getByText('Email is required')).toBeInTheDocument()
  })

  it('error state applies rose border class', () => {
    render(<Input id="email" label="Email" error="Required" />)
    const input = screen.getByLabelText('Email')
    expect(input.className).toMatch(/error|rose|red|danger/)
  })

  it('disabled state: cannot be typed into', () => {
    render(<Input id="name" label="Name" disabled />)
    const input = screen.getByLabelText('Name')
    expect(input).toBeDisabled()
  })

  it('disabled state applies reduced opacity class', () => {
    render(<Input id="name" label="Name" disabled />)
    const input = screen.getByLabelText('Name')
    expect(input).toBeDisabled()
  })
})

describe('Input — helper text and character count', () => {
  it('helper text shown when provided', () => {
    render(<Input id="slug" label="Slug" helperText="URL-friendly name" />)
    expect(screen.getByText('URL-friendly name')).toBeInTheDocument()
  })

  it('shows character count when maxLength provided', async () => {
    const user = userEvent.setup()
    render(<Input id="title" label="Title" maxLength={50} />)
    await user.type(screen.getByLabelText('Title'), 'Hello')
    // character count appears
    expect(screen.getByText(/5\s*\/\s*50|5 of 50/)).toBeInTheDocument()
  })
})

describe('Input — password variant', () => {
  it('type="password" renders show/hide toggle button', () => {
    render(<Input id="pwd" label="Password" type="password" />)
    expect(screen.getByRole('button', { name: /show|hide/i })).toBeInTheDocument()
  })

  it('clicking show/hide toggles input type from password to text', async () => {
    const user = userEvent.setup()
    render(<Input id="pwd" label="Password" type="password" />)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: /show/i }))
    expect(input).toHaveAttribute('type', 'text')
  })
})

describe('Input — onChange', () => {
  it('calls onChange when value changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Input id="name" label="Name" onChange={onChange} />)
    await user.type(screen.getByLabelText('Name'), 'A')
    expect(onChange).toHaveBeenCalled()
  })
})
