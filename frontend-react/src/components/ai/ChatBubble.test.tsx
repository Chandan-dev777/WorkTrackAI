import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatBubble } from './ChatBubble'

describe('ChatBubble — user bubble', () => {
  it('renders user message text', () => {
    render(<ChatBubble role="user" content="Hello AI" />)
    expect(screen.getByText('Hello AI')).toBeInTheDocument()
  })
})

describe('ChatBubble — assistant bubble', () => {
  it('renders assistant message content', () => {
    render(<ChatBubble role="assistant" content="Here is your answer" />)
    expect(screen.getByText('Here is your answer')).toBeInTheDocument()
  })

  it('AI bubble background uses CSS variable not hardcoded colour', () => {
    const { container } = render(<ChatBubble role="assistant" content="Test" />)
    // Find the bubble div — the immediate message container inside the flex wrapper
    const bubbles = container.querySelectorAll('[style*="background"]')
    const backgrounds = Array.from(bubbles).map(el =>
      (el as HTMLElement).style.background || (el as HTMLElement).style.backgroundColor
    )
    // Must NOT contain the hardcoded dark colour
    expect(backgrounds.join(' ')).not.toContain('#1a1f2e')
    // Must use the CSS variable for elevated background
    expect(backgrounds.join(' ')).toContain('var(--color-bg-elevated)')
  })

  it('error bubble uses danger colour background', () => {
    const { container } = render(<ChatBubble role="assistant" content="Error" isError />)
    const bubbles = container.querySelectorAll('[style*="background"]')
    const backgrounds = Array.from(bubbles).map(el =>
      (el as HTMLElement).style.background || (el as HTMLElement).style.backgroundColor
    )
    expect(backgrounds.join(' ')).toContain('rgba(244')
  })

  it('renders source chips when sources provided', () => {
    const sources = [{
      work_item_id: 'wi-1',
      work_date: '2026-04-14',
      task_description: 'Fixed login bug today',
      hours_spent: 2,
      work_category: 'project',
    }]
    render(<ChatBubble role="assistant" content="Answer" sources={sources} />)
    expect(screen.getByLabelText('Sources')).toBeInTheDocument()
    expect(screen.getByText(/2026-04-14/)).toBeInTheDocument()
  })

  it('does not render sources section when sources is empty', () => {
    render(<ChatBubble role="assistant" content="Answer" sources={[]} />)
    expect(screen.queryByLabelText('Sources')).not.toBeInTheDocument()
  })
})
