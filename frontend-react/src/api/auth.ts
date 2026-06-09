import { apiClient } from './client'
import type { User } from '@/types/models'

export interface TokenResponse {
  access_token: string
  token_type: string
  has_password: boolean
}

export interface LoginResult {
  token: string
  user: User
}

/** Login then immediately fetch the user profile. */
export async function login(email: string, password: string): Promise<LoginResult> {
  const { data } = await apiClient.post<TokenResponse>('/api/auth/login', { email, password })
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
  const user = await getMe()
  return { token: data.access_token, user }
}

export async function register(payload: {
  employee_id: string
  full_name: string
  email: string
  password: string
  role?: string
  team_name?: string
  department?: string
}): Promise<LoginResult> {
  const { data } = await apiClient.post<TokenResponse>('/api/auth/register', payload)
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
  const user = await getMe()
  return { token: data.access_token, user }
}

/** Try SSO auto-login using App Service identity headers. Returns null if not on App Service. */
export async function ssoLogin(): Promise<LoginResult | null> {
  try {
    const { data } = await apiClient.get<TokenResponse>('/api/auth/sso')
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
    const user = await getMe()
    return { token: data.access_token, user }
  } catch {
    return null
  }
}

/** Set a password for the first time (SSO users with no password yet). */
export async function setPassword(password: string): Promise<void> {
  await apiClient.post('/api/auth/set-password', { password })
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/api/auth/me')
  return data
}
