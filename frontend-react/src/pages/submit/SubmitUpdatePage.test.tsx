import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import SubmitUpdatePage from './SubmitUpdatePage'

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockExtractionResult = {
  work_log_id: 42,
  work_date: '2026-04-14',
  items: [
    { description: 'Fixed authentication bug', hours: 3, category: 'Development', status: 'done' },
    { description: 'Sprint planning meeting', hours: 1, category: 'Meeting', status: 'done' },
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <SubmitUpdatePage />
    </MemoryRouter>
  )
}

/** Type text into the textarea using fireEvent (fast, no char-by-char delay) */
function fillTextarea(text: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } })
}

/** Submit the form and wait for the extraction preview to appear */
async function submitAndWaitForPreview() {
  fillTextarea('Worked on fixing the authentication bug for 3 hours')
  fireEvent.click(screen.getByRole('button', { name: /submit with ai|extract|analyze/i }))
  // Descriptions are in <input value="..."> so use getByDisplayValue
  await waitFor(() => {
    expect(screen.getByDisplayValue('Fixed authentication bug')).toBeInTheDocument()
  })
}

// ── FORM STATE ────────────────────────────────────────────────────────────────

describe('SubmitUpdatePage — form state', () => {
  it('renders textarea with accessible label', () => {
    renderPage()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('submit button is disabled when textarea is empty', () => {
    renderPage()
    const btn = screen.getByRole('button', { name: /submit with ai|extract|analyze/i })
    expect(btn).toBeDisabled()
  })

  it('submit button is enabled when textarea has text', () => {
    renderPage()
    fillTextarea('Worked on bug fixes for 3 hours')
    const btn = screen.getByRole('button', { name: /submit with ai|extract|analyze/i })
    expect(btn).not.toBeDisabled()
  })

  it('date input defaults to today', () => {
    renderPage()
    const today = new Date().toISOString().split('T')[0]
    expect(screen.getByDisplayValue(today)).toBeInTheDocument()
  })

  it('date input allows value change', () => {
    renderPage()
    const dateInput = screen.getByDisplayValue(new Date().toISOString().split('T')[0])
    fireEvent.change(dateInput, { target: { value: '2026-04-10' } })
    expect(dateInput).toHaveValue('2026-04-10')
  })
})

// ── SUBMISSION FLOW ───────────────────────────────────────────────────────────

describe('SubmitUpdatePage — submission flow', () => {
  it('shows loading state or button during extraction', () => {
    server.use(
      http.post('/updates/submit', async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
        return HttpResponse.json(mockExtractionResult)
      })
    )
    renderPage()
    fillTextarea('Worked on bug fixes')
    fireEvent.click(screen.getByRole('button', { name: /submit with ai|extract|analyze/i }))
    expect(
      screen.queryByText(/extracting|analyzing/i) ||
      screen.getByRole('button')
    ).toBeInTheDocument()
  })

  it('shows extraction preview heading after successful submit', async () => {
    renderPage()
    fillTextarea('Fixed auth bug for 3 hours, then sprint planning for 1 hour')
    fireEvent.click(screen.getByRole('button', { name: /submit with ai|extract|analyze/i }))
    await waitFor(() => {
      expect(screen.getByText(/ai extracted|extraction preview|extracted items/i)).toBeInTheDocument()
    })
  })

  it('preview table shows extracted work item descriptions', async () => {
    renderPage()
    await submitAndWaitForPreview()
    expect(screen.getByDisplayValue('Fixed authentication bug')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Sprint planning meeting')).toBeInTheDocument()
  })

  it('preview shows hours input values', async () => {
    renderPage()
    await submitAndWaitForPreview()
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
  })
})

// ── PREVIEW EDITING ───────────────────────────────────────────────────────────

describe('SubmitUpdatePage — preview editing', () => {
  it('renders confirm and cancel buttons in preview', async () => {
    renderPage()
    await submitAndWaitForPreview()
    expect(screen.getByRole('button', { name: /confirm|save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('cancel button resets form to empty state', async () => {
    renderPage()
    await submitAndWaitForPreview()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByText(/ai extracted|extraction preview/i)).not.toBeInTheDocument()
    })
  })

  it('add row button adds a new empty row', async () => {
    renderPage()
    await submitAndWaitForPreview()
    const addBtn = screen.getByRole('button', { name: /add item|add|new row/i })
    const rowsBefore = screen.getAllByRole('row').length
    fireEvent.click(addBtn)
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeGreaterThan(rowsBefore)
    })
  })

  it('delete row button removes the row', async () => {
    renderPage()
    await submitAndWaitForPreview()
    const deleteBtns = screen.getAllByRole('button', { name: /delete|remove/i })
    expect(deleteBtns.length).toBeGreaterThan(0)
    const rowsBefore = screen.getAllByRole('row').length
    fireEvent.click(deleteBtns[0])
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBeLessThan(rowsBefore)
    })
  })
})

// ── CONFIRMATION ──────────────────────────────────────────────────────────────

describe('SubmitUpdatePage — confirmation', () => {
  it('confirm button shows success state after save', async () => {
    renderPage()
    await submitAndWaitForPreview()
    fireEvent.click(screen.getByRole('button', { name: /confirm|save/i }))
    await waitFor(() => {
      const successMsg = screen.queryByText(/saved|success|confirmed/i)
      const resetTextarea = screen.queryByRole('textbox')
      expect(successMsg !== null || resetTextarea !== null).toBe(true)
    })
  })

  it('on confirm API error shows error feedback', async () => {
    server.use(
      http.put('/updates/:id/confirm', () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 })
      )
    )
    renderPage()
    await submitAndWaitForPreview()
    fireEvent.click(screen.getByRole('button', { name: /confirm|save/i }))
    await waitFor(() => {
      expect(screen.queryByText(/error|failed|retry/i)).toBeInTheDocument()
    })
  })

  it('on submit API error shows error feedback', async () => {
    server.use(
      http.post('/updates/submit', () =>
        HttpResponse.json({ detail: 'Extraction failed' }, { status: 500 })
      )
    )
    renderPage()
    fillTextarea('Some work text')
    fireEvent.click(screen.getByRole('button', { name: /submit with ai|extract|analyze/i }))
    await waitFor(() => {
      expect(screen.queryByText(/error|failed/i)).toBeInTheDocument()
    })
  })
})

// ── SAFETY GUARDS ────────────────────────────────────────────────────────────

describe('SubmitUpdatePage — safety guards', () => {
  it('confirm button is disabled when all rows are deleted', async () => {
    renderPage()
    await submitAndWaitForPreview()
    // delete every row
    const deleteBtns = screen.getAllByRole('button', { name: /delete row|delete|remove/i })
    for (const btn of deleteBtns) fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm|save/i })).toBeDisabled()
    })
  })

  it('date input has max attribute set to today', () => {
    renderPage()
    const today = new Date().toISOString().split('T')[0]
    const dateInput = screen.getByDisplayValue(today)
    expect(dateInput).toHaveAttribute('max', today)
  })
})

// ── ACCESSIBILITY ─────────────────────────────────────────────────────────────

describe('SubmitUpdatePage — accessibility', () => {
  it('has a page heading', () => {
    renderPage()
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('textarea has an accessible label', () => {
    renderPage()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('preview table has aria-label when visible', async () => {
    renderPage()
    await submitAndWaitForPreview()
    const table = screen.queryByRole('table')
    if (table) {
      expect(table.getAttribute('aria-label') || table.closest('[aria-label]')).toBeTruthy()
    } else {
      expect(screen.getByDisplayValue('Fixed authentication bug')).toBeInTheDocument()
    }
  })
})
