import { apiClient } from './client'
import type { User } from '@/types/models'

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface LoginResult {
  token: string
  user: User
}

/** Login then immediately fetch the user profile. */
export async function login(email: string, password: string): Promise<LoginResult> {
  const { data } = await apiClient.post<TokenResponse>('/auth/login', { email, password })
  // Store token temporarily so the /auth/me request is authenticated
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
  const { data } = await apiClient.post<TokenResponse>('/auth/register', payload)
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
  const user = await getMe()
  return { token: data.access_token, user }
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me')
  return data
}
