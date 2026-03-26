import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { prisma } from '../db.js'
import { getConfig, paths } from '../config.js'
import { broadcastLog } from '../websocket.js'

const execAsync = promisify(exec)

export async function startBuild(buildId: number) {
  const build = await prisma.build.findUnique({
    where: { id: buildId },
    include: { project: true }
  })

  if (!build) return

  await prisma.build.update({
    where: { id: buildId },
    data: { status: 'running', startedAt: new Date() }
  })

  try {
    const config = getConfig()
    const repoDir = paths.projectRepo(config.workspaceDir, build.project.id)
    const outputDir = paths.buildOutput(config.workspaceDir, buildId)

    // 1. 准备仓库
    if (!fs.existsSync(repoDir)) {
      // 首次构建：克隆仓库
      await logAndExec(buildId, `git clone ${build.project.gitUrl} ${repoDir}`)
    } else {
      // 后续构建：更新仓库
      await logAndExec(buildId, `cd ${repoDir} && git fetch --all`)
    }

    // 2. 切换分支
    await logAndExec(buildId, `cd ${repoDir} && git checkout ${build.branch} && git pull`)

    // 3. 获取 commit hash
    const { stdout: commit } = await execAsync(`cd ${repoDir} && git rev-parse HEAD`)
    await prisma.build.update({
      where: { id: buildId },
      data: { gitCommit: commit.trim() }
    })

    // 4. 创建输出目录
    await execAsync(`mkdir -p ${outputDir}`)

    // 5. 执行构建
    await logAndExec(buildId, `cd ${repoDir} && ./gradlew ${build.gradleTask}`)

    // 6. 查找并复制 APK
    try {
      const { stdout: apkPath } = await execAsync(`find ${repoDir} -name "*.apk" -type f | head -1`)
      const trimmedPath = apkPath.trim()

      if (trimmedPath) {
        const apkName = path.basename(trimmedPath)
        await execAsync(`cp ${trimmedPath} ${outputDir}/${apkName}`)

        await prisma.build.update({
          where: { id: buildId },
          data: {
            status: 'success',
            finishedAt: new Date(),
            apkPath: `builds/${buildId}/output/${apkName}`
          }
        })
      } else {
        await prisma.build.update({
          where: { id: buildId },
          data: { status: 'success', finishedAt: new Date() }
        })
      }
    } catch {
      await prisma.build.update({
        where: { id: buildId },
        data: { status: 'success', finishedAt: new Date() }
      })
    }
  } catch (error) {
    await prisma.buildLog.create({
      data: {
        buildId,
        logType: 'stderr',
        content: (error as Error).message
      }
    })
    await prisma.build.update({
      where: { id: buildId },
      data: { status: 'failed', finishedAt: new Date() }
    })
  }
}

async function logAndExec(buildId: number, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = exec(command, { maxBuffer: 10 * 1024 * 1024 })

    process.stdout?.on('data', async (data: Buffer) => {
      const content = data.toString()
      await prisma.buildLog.create({
        data: { buildId, logType: 'stdout', content }
      })
      broadcastLog(buildId, 'stdout', content)
    })

    process.stderr?.on('data', async (data: Buffer) => {
      const content = data.toString()
      await prisma.buildLog.create({
        data: { buildId, logType: 'stderr', content }
      })
      broadcastLog(buildId, 'stderr', content)
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    process.on('error', reject)
  })
}
