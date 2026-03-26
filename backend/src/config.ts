import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import os from 'os'

const execAsync = promisify(exec)

export interface SystemConfig {
  workspaceDir: string
}

let config: SystemConfig = {
  workspaceDir: process.env.WORKSPACE_DIR ||
    path.join(os.homedir(), 'workspace', 'apk-builder')
}

export const paths = {
  repos: (workspaceDir: string) => path.join(workspaceDir, 'repos'),
  projectRepo: (workspaceDir: string, projectId: number) =>
    path.join(workspaceDir, 'repos', projectId.toString()),
  builds: (workspaceDir: string) => path.join(workspaceDir, 'builds'),
  buildDir: (workspaceDir: string, buildId: number) =>
    path.join(workspaceDir, 'builds', buildId.toString()),
  buildOutput: (workspaceDir: string, buildId: number) =>
    path.join(workspaceDir, 'builds', buildId.toString(), 'output'),
  sdkManager: (workspaceDir: string) => path.join(workspaceDir, 'sdk-manager'),
  temp: (workspaceDir: string) => path.join(workspaceDir, 'temp')
}

export async function initializeDirectories() {
  const cfg = getConfig()
  const dirs = [
    paths.repos(cfg.workspaceDir),
    paths.builds(cfg.workspaceDir),
    paths.sdkManager(cfg.workspaceDir),
    paths.temp(cfg.workspaceDir)
  ]

  for (const dir of dirs) {
    await execAsync(`mkdir -p "${dir}"`)
  }
}

export function getConfig(): SystemConfig {
  return config
}

export function updateConfig(newConfig: Partial<SystemConfig>): void {
  config = { ...config, ...newConfig }
}
