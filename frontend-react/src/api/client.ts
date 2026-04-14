import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

// Same-origin calls work in both dev (Vite proxy → :8000) and prod (FastAPI serves React)
export const apiClient = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401 (not from login), force logout
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)
