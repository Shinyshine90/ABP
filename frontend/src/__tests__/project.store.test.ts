import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '../stores/project'
import { projectApi } from '../api'

vi.mock('../api', () => ({
  projectApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn()
  }
}))

describe('Project Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetches projects', async () => {
    const mockProjects = [
      { id: 1, name: 'Test Project', git_url: 'https://github.com/test', branch: 'main', gradle_task: 'assembleRelease', created_at: '2024-01-01' }
    ]
    vi.mocked(projectApi.getAll).mockResolvedValue({ data: mockProjects } as any)

    const store = useProjectStore()
    await store.fetchProjects()

    expect(store.projects).toEqual(mockProjects)
    expect(store.loading).toBe(false)
  })

  it('creates project', async () => {
    const newProject = { id: 2, name: 'New Project', git_url: 'https://github.com/new', branch: 'main', gradle_task: 'assembleRelease', created_at: '2024-01-02' }
    vi.mocked(projectApi.create).mockResolvedValue({ data: newProject } as any)

    const store = useProjectStore()
    await store.createProject({ name: 'New Project', git_url: 'https://github.com/new', branch: 'main', gradle_task: 'assembleRelease' })

    expect(store.projects).toContainEqual(newProject)
  })
})
