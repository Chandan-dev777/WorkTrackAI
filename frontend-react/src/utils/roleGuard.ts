export type Role = 'employee' | 'manager' | 'admin'

export const ROLES = {
  EMPLOYEE: 'employee' as const,
  MANAGER:  'manager' as const,
  ADMIN:    'admin' as const,
}

const ROLE_LEVELS: Record<Role, number> = {
  employee: 1,
  manager:  2,
  admin:    3,
}

export function getRoleLevel(role: Role): number {
  return ROLE_LEVELS[role]
}

/**
 * Returns true if `userRole` has at least the access level of `requiredRole`.
 */
export function canAccess(userRole: Role, requiredRole: Role): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole)
}
