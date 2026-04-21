import { apiClient } from './client'
import type { UserTemplate } from '@/types/models'

export const templatesApi = {
  list: () =>
    apiClient.get<UserTemplate[]>('/templates/').then(r => r.data),

  create: (label: string, text: string) =>
    apiClient.post<UserTemplate>('/templates/', { label, text }).then(r => r.data),

  update: (id: string, data: { label?: string; text?: string }) =>
    apiClient.put<UserTemplate>(`/templates/${id}`, data).then(r => r.data),

  remove: (id: string) =>
    apiClient.delete(`/templates/${id}`),
}
