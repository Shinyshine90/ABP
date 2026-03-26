import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Project } from '../types'
import { projectApi } from '../api'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)

  async function fetchProjects() {
    loading.value = true
    try {
      const { data } = await projectApi.getAll()
      projects.value = data
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      loading.value = false
    }
  }

  async function createProject(project: Omit<Project, 'id' | 'created_at'>) {
    const { data } = await projectApi.create(project)
    projects.value.push(data)
    return data
  }

  async function deleteProject(id: number) {
    await projectApi.delete(id)
    projects.value = projects.value.filter(p => p.id !== id)
  }

  return { projects, loading, fetchProjects, createProject, deleteProject }
})
