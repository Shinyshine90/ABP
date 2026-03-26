import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function validateGitRepo(gitUrl: string, branch: string): Promise<boolean> {
  try {
    await execAsync(`git ls-remote ${gitUrl} ${branch}`)
    return true
  } catch {
    return false
  }
}

export async function cloneRepo(gitUrl: string, branch: string, targetDir: string): Promise<void> {
  await execAsync(`git clone -b ${branch} --depth 1 ${gitUrl} ${targetDir}`)
}
