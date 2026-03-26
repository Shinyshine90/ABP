export interface Project {
  id: number
  name: string
  git_url: string
  branch: string
  gradle_task: string
  description?: string
  created_at: string
}

export interface BuildTask {
  id: number
  project_id: number
  status: 'pending' | 'running' | 'success' | 'failed'
  version?: string
  git_commit?: string
  created_by?: string
  started_at?: string
  finished_at?: string
}

export interface BuildLog {
  id: number
  task_id: number
  log_type: 'stdout' | 'stderr'
  content: string
  timestamp: string
}
