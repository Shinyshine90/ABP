import type { Project, BuildTask, BuildLog } from '../types'

export const mockProjects: Project[] = [
  {
    id: 1,
    name: 'CarLauncher',
    git_url: 'https://github.com/company/car-launcher.git',
    branch: 'main',
    gradle_task: 'assembleRelease',
    description: '车载启动器应用',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 2,
    name: 'MediaPlayer',
    git_url: 'https://github.com/company/media-player.git',
    branch: 'develop',
    gradle_task: 'assembleDebug',
    description: '多媒体播放器',
    created_at: '2024-01-20T14:30:00Z'
  },
  {
    id: 3,
    name: 'Navigation',
    git_url: 'https://github.com/company/navigation.git',
    branch: 'main',
    gradle_task: 'assembleRelease',
    description: '导航应用',
    created_at: '2024-02-01T09:15:00Z'
  }
]

export const mockBuilds: Record<number, BuildTask[]> = {
  1: [
    { id: 1, project_id: 1, status: 'success', version: 'v1.2.0', git_commit: 'a1b2c3d', started_at: '2024-03-20 10:00:00', finished_at: '2024-03-20 10:05:00' },
    { id: 2, project_id: 1, status: 'failed', version: 'v1.1.9', git_commit: 'e4f5g6h', started_at: '2024-03-19 15:30:00', finished_at: '2024-03-19 15:32:00' },
    { id: 3, project_id: 1, status: 'success', version: 'v1.1.8', git_commit: 'i7j8k9l', started_at: '2024-03-18 09:00:00', finished_at: '2024-03-18 09:06:00' }
  ],
  2: [
    { id: 4, project_id: 2, status: 'running', git_commit: 'm0n1o2p', started_at: '2024-03-25 14:00:00' }
  ]
}

export const mockLogs: Record<number, BuildLog[]> = {
  1: [
    { id: 1, task_id: 1, log_type: 'stdout', content: '> Task :app:preBuild', timestamp: '2024-03-20 10:00:01' },
    { id: 2, task_id: 1, log_type: 'stdout', content: '> Task :app:compileReleaseKotlin', timestamp: '2024-03-20 10:01:00' },
    { id: 3, task_id: 1, log_type: 'stdout', content: 'BUILD SUCCESSFUL in 5m 12s', timestamp: '2024-03-20 10:05:00' }
  ]
}
