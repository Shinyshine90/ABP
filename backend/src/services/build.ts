import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { prisma } from '../db.js'
import { getConfig, paths } from '../config.js'
import { broadcastLog, broadcastBuildStatus } from '../websocket.js'

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

  // 添加初始日志
  await prisma.buildLog.create({
    data: {
      buildId,
      logType: 'stdout',
      content: `=== 开始构建 #${buildId} ===\n项目: ${build.project.name}\n分支: ${build.branch}\nJDK: ${build.jdkVersion}\n`
    }
  })
  broadcastLog(buildId, 'stdout', `=== 开始构建 #${buildId} ===\n`)

  try {
    const config = getConfig()
    const repoDir = paths.projectRepo(config.workspaceDir, build.project.id)
    const outputDir = paths.buildOutput(config.workspaceDir, buildId)

    // 1. 准备仓库
    if (!fs.existsSync(repoDir)) {
      // 首次构建：克隆仓库
      await logAndExec(buildId, `git clone --progress ${build.project.gitUrl} ${repoDir}`)
    } else {
      // 后续构建：更新仓库
      await logAndExec(buildId, `git -C ${repoDir} fetch --all --progress`)
    }

    // 2. 切换分支
    await logAndExec(buildId, `git -C ${repoDir} checkout ${build.branch} && git -C ${repoDir} pull --progress`)

    // 3. 获取 commit hash
    const { stdout: commit } = await execAsync(`cd ${repoDir} && git rev-parse HEAD`)
    await prisma.build.update({
      where: { id: buildId },
      data: { gitCommit: commit.trim() }
    })

    // 4. 创建输出目录
    await execAsync(`mkdir -p ${outputDir}`)

    // 5. 执行构建
    const androidHome = config.androidHome || paths.sdkManager(config.workspaceDir)
    const workspaceJdk = paths.jdk(config.workspaceDir, build.jdkVersion)

    // 优先使用 workspace JDK，如果不存在则使用系统 JDK
    let javaHome = workspaceJdk
    let javaCommand = `${javaHome}/bin/java`

    if (!fs.existsSync(path.join(workspaceJdk, 'bin', 'java'))) {
      // workspace JDK 不存在，尝试使用系统 JDK
      // macOS 用 /usr/libexec/java_home 按版本查找，Linux 用 update-java-alternatives
      const versionArg = build.jdkVersion === '8' ? '1.8' : build.jdkVersion
      let found = false

      // 1. 先尝试 macOS java_home（按指定版本）
      try {
        const { stdout } = await execAsync(`/usr/libexec/java_home -v ${versionArg} 2>/dev/null`)
        const home = stdout.trim()
        if (home && fs.existsSync(path.join(home, 'bin', 'java'))) {
          javaHome = home
          javaCommand = path.join(home, 'bin', 'java')
          found = true
        }
      } catch {}

      // 2. 再尝试 JAVA_HOME 环境变量（Docker / CI 场景）
      if (!found && process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, 'bin', 'java'))) {
        javaHome = process.env.JAVA_HOME
        javaCommand = path.join(javaHome, 'bin', 'java')
        found = true
      }

      if (!found) {
        throw new Error(`JDK ${build.jdkVersion} 未安装，请先在环境部署中安装`)
      }

      await logAndExec(buildId, `echo "⚠️  Workspace JDK ${build.jdkVersion} 未安装，使用系统 JDK: ${javaHome}"`)
    }

    // 输出环境变量信息
    await logAndExec(buildId, `echo "=== 环境变量检查 ===" && echo "ANDROID_HOME: ${androidHome}" && echo "JAVA_HOME: ${javaHome}" && echo "Java 版本:" && ${javaCommand} -version 2>&1 | head -1`)

    // --no-daemon 避免 Gradle daemon 导致输出无法捕获；--console=plain 禁用富文本格式
    await logAndExecSpawn(buildId, './gradlew', [build.gradleTask, '--no-daemon', '--console=plain'], {
      cwd: repoDir,
      env: { ...process.env, ANDROID_HOME: androidHome, JAVA_HOME: javaHome, PATH: `${javaHome}/bin:${process.env.PATH}`, FORCE_COLOR: '0' }
    })

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
      broadcastBuildStatus(buildId, 'success')
    } catch {
      await prisma.build.update({
        where: { id: buildId },
        data: { status: 'success', finishedAt: new Date() }
      })
      broadcastBuildStatus(buildId, 'success')
    }
  } catch (error) {
    broadcastLog(buildId, 'stderr', `\n=== 构建失败: ${(error as Error).message} ===\n`)
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
    broadcastBuildStatus(buildId, 'failed')
  }
}

async function logAndExec(buildId: number, command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const childProcess = exec(command, {
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, FORCE_COLOR: '0' }
    })

    childProcess.stdout?.on('data', (data: Buffer) => {
      const content = data.toString()
      broadcastLog(buildId, 'stdout', content)
      prisma.buildLog.create({ data: { buildId, logType: 'stdout', content } }).catch(() => {})
    })

    childProcess.stderr?.on('data', (data: Buffer) => {
      const content = data.toString()
      broadcastLog(buildId, 'stderr', content)
      prisma.buildLog.create({ data: { buildId, logType: 'stderr', content } }).catch(() => {})
    })

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    childProcess.on('error', reject)
  })
}

// 专为 Gradle 设计：用 spawn 直接拿到进程 stdio，不经过 shell 二次缓冲
async function logAndExecSpawn(
  buildId: number,
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    childProcess.stdout.on('data', (data: Buffer) => {
      const content = data.toString()
      broadcastLog(buildId, 'stdout', content)
      prisma.buildLog.create({ data: { buildId, logType: 'stdout', content } }).catch(() => {})
    })

    childProcess.stderr.on('data', (data: Buffer) => {
      const content = data.toString()
      broadcastLog(buildId, 'stderr', content)
      prisma.buildLog.create({ data: { buildId, logType: 'stderr', content } }).catch(() => {})
    })

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Gradle exited with code ${code}`))
      }
    })

    childProcess.on('error', reject)
  })
}
