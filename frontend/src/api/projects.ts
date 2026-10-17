import { request } from './http'
import type { ProjectRequest, ProjectResponse, ProjectSummary } from './types'

export const projectsApi = {
  list: (signal?: AbortSignal) => request<ProjectSummary[]>('GET', '/api/projects', undefined, signal),
  get: (id: string) => request<ProjectResponse>('GET', `/api/projects/${id}`),
  create: (body: ProjectRequest) => request<ProjectResponse>('POST', '/api/projects', body),
  update: (id: string, body: ProjectRequest) => request<ProjectResponse>('PUT', `/api/projects/${id}`, body),
  rename: (id: string, name: string, version: number) => request<ProjectResponse>('PATCH', `/api/projects/${id}`, { name, version }),
  remove: (id: string) => request<void>('DELETE', `/api/projects/${id}`),
  duplicate: (id: string) => request<ProjectResponse>('POST', `/api/projects/${id}/duplicate`),
}
