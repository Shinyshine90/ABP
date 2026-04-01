import axios from 'axios'
import type { Project, BuildTask, BuildLog } from '../types'
import { mockProjects, mockBuilds, mockLogs } from '../mock/data'

const USE_MOCK = false // 切换为false使用真实API

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const projectApi = {
  getAll: async () => {
    if (USE_MOCK) {
      await delay(300)
      return { data: mockProjects }
    }
    return api.get<Project[]>('/projects')
  },
  getById: async (id: number) => {
    if (USE_MOCK) {
      await delay(200)
      return { data: mockProjects.find(p => p.id === id) }
    }
    return api.get<Project>(`/projects/${id}`)
  },
  create: async (data: Omit<Project, 'id' | 'created_at'>) => {
    if (USE_MOCK) {
      await delay(500)
      const newProject = { ...data, id: Date.now(), created_at: new Date().toISOString() }
      mockProjects.push(newProject)
      return { data: newProject }
    }
    return api.post<Project>('/projects', data)
  },
  update: (id: number, data: Partial<Project>) => api.put<Project>(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  validateGit: (gitUrl: string, branch: string) => api.post('/projects/validate-git', { git_url: gitUrl, branch }),
  getBuildOptions: (id: number) => api.get<{ branches: string[], flavors: string[], tasks: string[], synced: boolean, syncError: string }>(`/projects/${id}/build-options`)
}

export const buildApi = {
  getAll: async (page = 1, limit = 20) => {
    if (USE_MOCK) {
      await delay(300)
      return { data: Object.values(mockBuilds).flat() }
    }
    return api.get<BuildTask[]>(`/builds?page=${page}&limit=${limit}`)
  },
  getByProject: async (projectId: number) => {
    if (USE_MOCK) {
      await delay(300)
      return { data: mockBuilds[projectId] || [] }
    }
    return api.get<BuildTask[]>(`/projects/${projectId}/builds`)
  },
  create: async (projectId: number, branch?: string, gradleTask?: string, jdkVersion?: string) => {
    if (USE_MOCK) {
      await delay(500)
      const newBuild = { id: Date.now(), project_id: projectId, status: 'pending' as const, started_at: new Date().toLocaleString() }
      if (!mockBuilds[projectId]) mockBuilds[projectId] = []
      mockBuilds[projectId].unshift(newBuild)
      return { data: newBuild }
    }
    return api.post<BuildTask>('/builds', { project_id: projectId, branch, gradle_task: gradleTask, jdk_version: jdkVersion })
  },
  getById: (id: number) => api.get<BuildTask>(`/builds/${id}`),
  getLogs: async (id: number) => {
    if (USE_MOCK) {
      await delay(200)
      return { data: mockLogs[id] || [] }
    }
    return api.get<BuildLog[]>(`/builds/${id}/logs`)
  },
  cancel: (id: number) => api.delete(`/builds/${id}`)
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; username: string }>('/auth/login', { username, password }),
  register: (username: string, password: string) =>
    api.post('/auth/register', { username, password })
}

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: any) => api.put('/settings', data),
  checkEnv: () => api.get('/settings/check-env'),
  getVersions: () => api.get('/settings/available-versions'),
  installTool: (tool: string, version: string) => api.post('/settings/install-tool', { tool, version }),
  getCacheInfo: () => api.get('/settings/cache-info'),
  clearCache: (data: { target?: string; strategy?: string; days?: number }) => api.post('/settings/clear-cache', data),
  getSshKey: () => api.get('/settings/ssh-key'),
  getAvailableJdk: () => api.get<{ version: string, path: string, source: string }[]>('/settings/available-jdk')
}

export const statsApi = {
  get: () => api.get('/stats')
}
