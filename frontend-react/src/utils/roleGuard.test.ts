import { describe, it, expect } from 'vitest'
import { canAccess, getRoleLevel, ROLES } from './roleGuard'

describe('canAccess', () => {
  it('employee can access employee-level routes', () => {
    expect(canAccess('employee', 'employee')).toBe(true)
  })

  it('employee cannot access manager-level routes', () => {
    expect(canAccess('employee', 'manager')).toBe(false)
  })

  it('employee cannot access admin-level routes', () => {
    expect(canAccess('employee', 'admin')).toBe(false)
  })

  it('manager can access employee-level routes', () => {
    expect(canAccess('manager', 'employee')).toBe(true)
  })

  it('manager can access manager-level routes', () => {
    expect(canAccess('manager', 'manager')).toBe(true)
  })

  it('manager cannot access admin-level routes', () => {
    expect(canAccess('manager', 'admin')).toBe(false)
  })

  it('admin can access all levels', () => {
    expect(canAccess('admin', 'employee')).toBe(true)
    expect(canAccess('admin', 'manager')).toBe(true)
    expect(canAccess('admin', 'admin')).toBe(true)
  })
})

describe('getRoleLevel', () => {
  it('returns numeric level for each role', () => {
    expect(getRoleLevel('employee')).toBeLessThan(getRoleLevel('manager'))
    expect(getRoleLevel('manager')).toBeLessThan(getRoleLevel('admin'))
  })
})

describe('ROLES constant', () => {
  it('exports expected role values', () => {
    expect(ROLES.EMPLOYEE).toBe('employee')
    expect(ROLES.MANAGER).toBe('manager')
    expect(ROLES.ADMIN).toBe('admin')
  })
})
