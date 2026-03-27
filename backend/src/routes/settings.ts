import { Router } from 'express'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { authMiddleware } from '../middleware/auth.js'
import { getConfig, updateConfig, paths } from '../config.js'
import { prisma } from '../db.js'

const execAsync = promisify(exec)
const router = Router()

router.get('/', authMiddleware, (req, res) => {
  res.json(getConfig())
})

router.put('/', authMiddleware, (req, res) => {
  updateConfig(req.body)
  res.json(getConfig())
})

router.get('/available-versions', authMiddleware, (req, res) => {
  res.json({
    git: ['2.43.0', '2.42.0', '2.41.0'],
    jdk: ['17', '11', '21'],
    android_sdk: ['34', '33', '32']
  })
})

router.get('/check-env', authMiddleware, async (req, res) => {
  const result = {
    git: { installed: false, version: '' },
    jdk: { installed: false, version: '' },
    androidSdk: { installed: false, version: '' }
  }

  try {
    const { stdout } = await execAsync('git --version')
    result.git = { installed: true, version: stdout.trim() }
  } catch {}

  try {
    const { stdout } = await execAsync('java -version 2>&1')
    const match = stdout.match(/version "(.+?)"/)
    result.jdk = { installed: true, version: match ? match[1] : stdout.split('\n')[0] }
  } catch {}

  try {
    const config = getConfig()
    const sdkManagerPath = path.join(paths.sdkManager(config.workspaceDir), 'cmdline-tools', 'latest', 'bin', 'sdkmanager')
    if (fs.existsSync(sdkManagerPath)) {
      result.androidSdk = { installed: true, version: 'SDK Manager' }
    }
  } catch {}{}

  res.json(result)
})

router.post('/install-env', authMiddleware, async (req, res) => {
  const { git_version, jdk_version, android_sdk_version } = req.body

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Transfer-Encoding', 'chunked')

  const send = (tool: string, status: string, progress: number) => {
    res.write(JSON.stringify({ tool, status, progress }) + '\n')
  }

  try {
    // Install Git
    send('Git', `安装 Git ${git_version}...`, 10)
    await execAsync(`which git || (apt-get update && apt-get install -y git || yum install -y git || brew install git)`)
    send('Git', '安装完成', 100)

    // Install JDK
    send('JDK', `安装 JDK ${jdk_version}...`, 10)
    const jdkCmd = jdk_version === '17' ? 'openjdk-17-jdk' : jdk_version === '11' ? 'openjdk-11-jdk' : 'openjdk-21-jdk'
    await execAsync(`which java || (apt-get install -y ${jdkCmd} || yum install -y java-${jdk_version}-openjdk || brew install openjdk@${jdk_version})`)
    send('JDK', '安装完成', 100)

    // Install Android SDK
    send('Android SDK', `安装 Android SDK ${android_sdk_version}...`, 10)
    const sdkUrl = 'https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip'
    await execAsync(`mkdir -p /opt/android-sdk/cmdline-tools && cd /tmp && wget ${sdkUrl} -O sdk.zip && unzip -q sdk.zip -d /opt/android-sdk/cmdline-tools && mv /opt/android-sdk/cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/latest`)
    send('Android SDK', '配置环境变量...', 50)
    await execAsync('echo "export ANDROID_HOME=/opt/android-sdk" >> ~/.bashrc && echo "export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools" >> ~/.bashrc')
    send('Android SDK', '安装完成', 100)

    res.end()
  } catch (error) {
    send('Error', '安装失败: ' + (error as Error).message, 0)
    res.end()
  }
})

router.post('/install-tool', authMiddleware, async (req, res) => {
  const { tool, version } = req.body
  const config = getConfig()
  const sudo_password = config.sudoPassword

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Transfer-Encoding', 'chunked')
  res.setHeader('Cache-Control', 'no-cache')

  const send = (progress: number, message: string, log?: string) => {
    res.write(JSON.stringify({ progress, message, log }) + '\n')
    if (typeof (res as any).flush === 'function') {
      (res as any).flush()
    }
  }

  const execWithSudo = async (cmd: string) => {
    if (sudo_password) {
      return execAsync(`echo "${sudo_password}" | sudo -S ${cmd}`)
    }
    return execAsync(cmd)
  }

  const execWithSudoStreaming = (
    cmd: string,
    args: string[],
    onLine: (line: string) => void
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const proc = sudo_password
        ? spawn('sudo', ['-S', cmd, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
        : spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })

      if (sudo_password) {
        proc.stdin?.write(sudo_password + '\n')
        proc.stdin?.end()
      }

      proc.stdout?.on('data', (data) => {
        data.toString().split('\n').filter((l: string) => l.trim()).forEach(onLine)
      })

      proc.stderr?.on('data', (data) => {
        data.toString().split('\n').filter((l: string) => l.trim()).forEach(onLine)
      })

      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Command failed with exit code ${code}`))
      })
    })
  }

  try {
    if (tool === 'git') {
      send(5, '准备安装 Git...', 'Preparing installation')
      await new Promise(resolve => setTimeout(resolve, 500))

      send(15, '更新软件源...', '$ sudo apt-get update')
      await execWithSudoStreaming('apt-get', ['update'], (line) => {
        send(15, '更新软件源...', line)
      })

      send(30, '下载 Git 包...', 'Preparing to download Git')
      await new Promise(resolve => setTimeout(resolve, 500))

      send(60, '安装 Git...', '$ sudo apt-get install -y git')
      await execWithSudoStreaming('apt-get', ['install', '-y', 'git'], (line) => {
        send(60, '安装 Git...', line)
      })

      send(80, '配置 Git...', 'Configuring Git')
      await new Promise(resolve => setTimeout(resolve, 500))

      send(95, '检测环境...', '$ git --version')
      try {
        const { stdout: gitVersion } = await execAsync('git --version')
        send(100, '安装完成', `Git installed: ${gitVersion.trim()}`)
      } catch (e: any) {
        send(100, '安装完成', e.message || 'Git installation completed')
      }
    } else if (tool === 'jdk') {
      const jdkDir = paths.jdk(config.workspaceDir, version)
      const tempDir = paths.temp(config.workspaceDir)
      const jdkTarball = path.join(tempDir, `jdk-${version}.tar.gz`)

      send(5, '准备安装 JDK...', 'Preparing installation')
      await execAsync(`mkdir -p ${tempDir}`)

      // 检查 wget
      send(8, '检查依赖...', 'Checking for wget')
      try {
        await execAsync('which wget')
        send(8, '检查依赖...', 'wget is installed')
      } catch {
        send(10, '安装 wget...', '$ brew install wget')
        if (os.platform() === 'darwin') {
          await execAsync('brew install wget')
        } else {
          await execWithSudoStreaming('apt-get', ['install', '-y', 'wget'], (line) => {
            send(10, '安装 wget...', line)
          })
        }
      }

      const platform = os.platform()
      const isMac = platform === 'darwin'
      const jdkUrls: { [key: string]: string } = isMac ? {
        '8': 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u432-b06/OpenJDK8U-jdk_x64_mac_hotspot_8u432b06.tar.gz',
        '11': 'https://github.com/adoptium/temurin11-binaries/releases/download/jdk-11.0.25%2B9/OpenJDK11U-jdk_x64_mac_hotspot_11.0.25_9.tar.gz',
        '17': 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_mac_hotspot_17.0.13_11.tar.gz'
      } : {
        '8': 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u432-b06/OpenJDK8U-jdk_x64_linux_hotspot_8u432b06.tar.gz',
        '11': 'https://github.com/adoptium/temurin11-binaries/releases/download/jdk-11.0.25%2B9/OpenJDK11U-jdk_x64_linux_hotspot_11.0.25_9.tar.gz',
        '17': 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_linux_hotspot_17.0.13_11.tar.gz'
      }

      const jdkUrl = jdkUrls[version]
      if (!jdkUrl) {
        throw new Error(`不支持的 JDK 版本: ${version}`)
      }

      send(15, `下载 JDK ${version}...`, `$ wget ${jdkUrl}`)
      const wgetProc = spawn('bash', ['-c', `cd ${tempDir} && wget ${jdkUrl} -O ${jdkTarball} 2>&1`])
      let buffer = ''
      wgetProc.stdout?.on('data', (data) => {
        buffer += data.toString()
        const segments = buffer.split('\r')
        buffer = segments[segments.length - 1]
        for (let i = 0; i < segments.length - 1; i++) {
          const lines = segments[i].split('\n').filter((l: string) => l.trim())
          lines.forEach((line: string) => {
            send(15, `下载 JDK ${version}...`, line)
          })
        }
        const lastSegmentLines = buffer.split('\n')
        if (lastSegmentLines.length > 1) {
          for (let i = 0; i < lastSegmentLines.length - 1; i++) {
            if (lastSegmentLines[i].trim()) {
              send(15, `下载 JDK ${version}...`, lastSegmentLines[i])
            }
          }
          buffer = lastSegmentLines[lastSegmentLines.length - 1]
        }
      })
      await new Promise((resolve, reject) => {
        wgetProc.on('close', (code) => {
          if (buffer.trim()) {
            send(15, `下载 JDK ${version}...`, buffer.trim())
          }
          code === 0 ? resolve(code) : reject(new Error('下载失败'))
        })
      })

      send(50, '解压 JDK...', `$ tar -xzf jdk-${version}.tar.gz`)
      await execAsync(`mkdir -p ${jdkDir}`)
      await execAsync(`tar -xzf ${jdkTarball} -C ${jdkDir} --strip-components=1`)

      send(80, '验证安装...', 'Verifying installation')
      const { stdout: javaVersion } = await execAsync(`${jdkDir}/bin/java -version 2>&1`)

      send(90, '清理临时文件...', 'Cleaning up')
      await execAsync(`rm -f ${jdkTarball}`)

      send(100, '安装完成', `JDK ${version} installed: ${javaVersion.split('\n')[0]}`)
    } else if (tool === 'android_sdk') {
      const config = getConfig()
      const tempDir = paths.temp(config.workspaceDir)
      const sdkManagerDir = paths.sdkManager(config.workspaceDir)
      const sdkZip = path.join(tempDir, 'commandlinetools-linux-9477386_latest.zip')

      send(5, '准备安装 Android SDK...', 'Preparing installation')
      await new Promise(resolve => setTimeout(resolve, 500))

      // 检查并安装 unzip
      send(10, '检查依赖...', 'Checking for unzip')
      try {
        await execAsync('which unzip')
        send(10, '检查依赖...', 'unzip is installed')
      } catch {
        send(15, '安装 unzip...', '$ sudo apt-get install -y unzip')
        await execWithSudoStreaming('apt-get', ['install', '-y', 'unzip'], (line) => {
          send(15, '安装 unzip...', line)
        })
      }

      send(25, `下载 SDK 工具...`, '$ wget commandlinetools-linux')
      const sdkUrl = 'https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip'
      await execAsync(`mkdir -p ${tempDir}`)
      const wgetProc = spawn('bash', ['-c', `cd ${tempDir} && wget ${sdkUrl} -O ${sdkZip} 2>&1`])
      let buffer = ''
      wgetProc.stdout?.on('data', (data) => {
        buffer += data.toString()
        const segments = buffer.split('\r')
        buffer = segments[segments.length - 1]
        for (let i = 0; i < segments.length - 1; i++) {
          const lines = segments[i].split('\n').filter((l: string) => l.trim())
          lines.forEach((line: string) => {
            send(25, '下载 SDK 工具...', line)
          })
        }
        const lastSegmentLines = buffer.split('\n')
        if (lastSegmentLines.length > 1) {
          for (let i = 0; i < lastSegmentLines.length - 1; i++) {
            if (lastSegmentLines[i].trim()) {
              send(25, '下载 SDK 工具...', lastSegmentLines[i])
            }
          }
          buffer = lastSegmentLines[lastSegmentLines.length - 1]
        }
      })
      await new Promise((resolve, reject) => {
        wgetProc.on('close', (code) => {
          if (buffer.trim()) {
            send(25, '下载 SDK 工具...', buffer.trim())
          }
          code === 0 ? resolve(code) : reject(new Error('下载失败'))
        })
      })

      send(40, '解压 SDK...', '$ unzip sdk.zip')
      try {
        await execAsync(`mkdir -p ${sdkManagerDir}/cmdline-tools`)
        await execAsync(`cd ${tempDir} && unzip -o -q ${sdkZip} -d ${sdkManagerDir}/cmdline-tools`)

        // 验证解压是否成功
        const cmdlineToolsPath = path.join(sdkManagerDir, 'cmdline-tools', 'cmdline-tools')
        if (!fs.existsSync(cmdlineToolsPath)) {
          throw new Error('解压后未找到 cmdline-tools 目录')
        }

        await execAsync(`mv ${sdkManagerDir}/cmdline-tools/cmdline-tools ${sdkManagerDir}/cmdline-tools/latest`)
        send(40, '解压 SDK...', 'Extracted successfully')
      } catch (e: any) {
        throw new Error(`解压失败: ${e.message}`)
      }

      send(60, '接受 SDK Licenses...', '$ yes | sdkmanager --licenses')
      const proc = spawn('bash', ['-c',
        `export ANDROID_HOME=${sdkManagerDir} && yes | ${sdkManagerDir}/cmdline-tools/latest/bin/sdkmanager --licenses 2>&1`
      ])
      proc.stdout?.on('data', (data) => {
        data.toString().split('\n').filter((l: string) => l.trim()).forEach((line: string) => {
          send(60, '接受 SDK Licenses...', line)
        })
      })
      proc.stderr?.on('data', (data) => {
        data.toString().split('\n').filter((l: string) => l.trim()).forEach((line: string) => {
          send(60, '接受 SDK Licenses...', line)
        })
      })
      await new Promise((resolve, reject) => {
        proc.on('close', (code) => code === 0 ? resolve(code) : reject(new Error('License failed')))
      })

      send(80, '配置进程环境变量...', 'Setting ANDROID_HOME for build process')

      // 设置当前进程的环境变量（仅用于后续构建，不污染系统环境）
      process.env.ANDROID_HOME = sdkManagerDir
      process.env.PATH = `${process.env.PATH}:${sdkManagerDir}/cmdline-tools/latest/bin:${sdkManagerDir}/platform-tools`

      send(90, '清理临时文件...', 'Cleaning up')
      try {
        await execAsync(`rm -f ${sdkZip}`)
      } catch {}

      send(95, '检测环境...', 'Verifying installation')
      try {
        await execAsync(`test -f ${sdkManagerDir}/cmdline-tools/latest/bin/sdkmanager`)
        send(100, '安装完成', 'Android SDK Manager installed successfully')
      } catch {
        throw new Error('安装验证失败')
      }

      // 保存到配置
      updateConfig({ androidHome: sdkManagerDir })
    }

    res.end()
  } catch (error) {
    send(0, '安装失败: ' + (error as Error).message, (error as Error).message)
    res.end()
  }
})

router.get('/cache-info', authMiddleware, async (req, res) => {
  try {
    const config = getConfig()

    const getSize = async (dir: string) => {
      try {
        const { stdout } = await execAsync(`du -sb "${dir}" 2>/dev/null || echo "0"`)
        return Math.round((parseInt(stdout.split('\t')[0] || '0') / 1024 / 1024) * 100) / 100
      } catch {
        return 0
      }
    }

    const [reposSize, buildsSize, sdkManagerSize, tempSize] = await Promise.all([
      getSize(paths.repos(config.workspaceDir)),
      getSize(paths.builds(config.workspaceDir)),
      getSize(paths.sdkManager(config.workspaceDir)),
      getSize(paths.temp(config.workspaceDir))
    ])

    const buildCount = await prisma.build.count()
    const failedCount = await prisma.build.count({ where: { status: 'failed' } })
    const runningCount = await prisma.build.count({ where: { status: 'running' } })

    res.json({
      total_size_mb: reposSize + buildsSize + sdkManagerSize + tempSize,
      repos: { size_mb: reposSize },
      builds: { size_mb: buildsSize, count: buildCount, failed_count: failedCount, running_count: runningCount },
      sdk_manager: { size_mb: sdkManagerSize },
      temp: { size_mb: tempSize }
    })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

router.get('/ssh-key', authMiddleware, async (req, res) => {
  try {
    const sshDir = path.join(process.env.HOME || '~', '.ssh')
    const publicKeyPath = path.join(sshDir, 'id_rsa.pub')

    if (!fs.existsSync(publicKeyPath)) {
      await execAsync(`mkdir -p ${sshDir}`)
      await execAsync(`ssh-keygen -t rsa -b 4096 -f ${sshDir}/id_rsa -N "" -C "apk-builder"`)
    }

    const publicKey = fs.readFileSync(publicKeyPath, 'utf-8')
    res.json({ public_key: publicKey.trim() })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

router.post('/clear-cache', authMiddleware, async (req, res) => {
  try {
    const { strategy, days, target } = req.body
    const config = getConfig()

    let deletedCount = 0
    let freedSpace = 0

    if (target === 'temp' || target === 'all') {
      // 清理临时文件
      const tempDir = paths.temp(config.workspaceDir)
      try {
        const { stdout } = await execAsync(`du -sb "${tempDir}" 2>/dev/null || echo "0"`)
        const bytes = parseInt(stdout.split('\t')[0] || '0')
        freedSpace += bytes
        await execAsync(`rm -rf ${tempDir}/* 2>/dev/null || true`)
        await execAsync(`mkdir -p ${tempDir}`)
      } catch {}
    }

    if (target === 'builds' || target === 'all' || !target) {
      // 清理构建目录
      let builds: any[] = []
      if (strategy === 'all') {
        builds = await prisma.build.findMany({ where: { status: { not: 'running' } } })
      } else if (strategy === 'failed') {
        builds = await prisma.build.findMany({ where: { status: 'failed' } })
      } else if (strategy === 'old') {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - (days || 7))
        builds = await prisma.build.findMany({
          where: {
            status: { not: 'running' },
            finishedAt: { lt: cutoffDate }
          }
        })
      }

      for (const build of builds) {
        const buildDir = paths.buildDir(config.workspaceDir, build.id)
        const resolvedPath = path.resolve(buildDir)
        const resolvedWorkspace = path.resolve(config.workspaceDir)

        if (!resolvedPath.startsWith(resolvedWorkspace)) continue

        try {
          const { stdout } = await execAsync(`du -sb "${buildDir}" 2>/dev/null || echo "0"`)
          const bytes = parseInt(stdout.split('\t')[0] || '0')
          freedSpace += bytes

          await execAsync(`rm -rf "${buildDir}"`)

          await prisma.build.update({
            where: { id: build.id },
            data: { apkPath: null }
          })

          deletedCount++
        } catch {}
      }
    }

    res.json({
      deleted_count: deletedCount,
      freed_space_mb: Math.round((freedSpace / 1024 / 1024) * 100) / 100
    })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

export default router
