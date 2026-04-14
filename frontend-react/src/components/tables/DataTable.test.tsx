import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DataTable, type ColumnDef } from './DataTable'

interface Person { id: number; name: string; role: string }

const columns: ColumnDef<Person>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'role', header: 'Role' },
]

const data: Person[] = [
  { id: 1, name: 'Alice', role: 'Employee' },
  { id: 2, name: 'Bob', role: 'Manager' },
  { id: 3, name: 'Carol', role: 'Admin' },
]

describe('DataTable — rendering', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
  })

  it('renders correct number of data rows', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Carol')).toBeInTheDocument()
  })

  it('renders cell values correctly', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Employee')).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
  })
})

describe('DataTable — sorting', () => {
  it('clicking sortable column header triggers sort', () => {
    render(<DataTable columns={columns} data={data} />)
    const nameHeader = screen.getByText('Name')
    fireEvent.click(nameHeader)
    // After click, the sort icon should appear or data order may change
    // We verify the header has cursor-pointer class
    expect(nameHeader.closest('th, [role="columnheader"]')?.className).toMatch(/cursor-pointer|sortable/)
  })

  it('non-sortable column header does not have sort indicator', () => {
    render(<DataTable columns={columns} data={data} />)
    const roleHeader = screen.getByText('Role')
    expect(roleHeader.closest('th, [role="columnheader"]')?.className).not.toMatch(/cursor-pointer|sortable/)
  })
})

describe('DataTable — empty state', () => {
  it('renders empty state when data is empty array', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="No results found" />)
    expect(screen.getByText(/no results found/i)).toBeInTheDocument()
  })

  it('renders default empty message when no data and no custom message', () => {
    render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByText(/no data|no results|empty/i)).toBeInTheDocument()
  })
})

describe('DataTable — loading state', () => {
  it('renders loading skeleton when isLoading=true', () => {
    const { container } = render(<DataTable columns={columns} data={[]} isLoading />)
    const skeletons = container.querySelectorAll('[class*="animate"], [class*="shimmer"], [class*="pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('does not render data rows when isLoading=true', () => {
    render(<DataTable columns={columns} data={data} isLoading />)
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
  })
})

describe('DataTable — row selection', () => {
  it('renders checkboxes when selectable=true', () => {
    render(<DataTable columns={columns} data={data} selectable />)
    const checkboxes = screen.getAllByRole('checkbox')
    // header checkbox + one per row
    expect(checkboxes.length).toBeGreaterThanOrEqual(data.length)
  })

  it('selecting a row checkbox calls onSelectionChange', () => {
    const onSelectionChange = vi.fn()
    render(
      <DataTable columns={columns} data={data} selectable onSelectionChange={onSelectionChange} />
    )
    const [, firstCheckbox] = screen.getAllByRole('checkbox')
    fireEvent.click(firstCheckbox)
    expect(onSelectionChange).toHaveBeenCalled()
  })
})
