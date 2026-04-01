import { Router } from 'express'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { toSnakeCase } from '../utils/transform.js'
import { validateGitRepo } from '../utils/git.js'
import { getConfig, paths } from '../config.js'

const execAsync = promisify(exec)
const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: 'desc' } })
  res.json(toSnakeCase(projects))
})

router.get('/:id', authMiddleware, async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: Number(req.params.id) } })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  res.json(toSnakeCase(project))
})

router.post('/', authMiddleware, async (req, res) => {
  const { git_url, clone_method, description } = req.body

  // 检查是否已存在相同的 Git 仓库
  const existingProject = await prisma.project.findFirst({
    where: { gitUrl: git_url }
  })
  if (existingProject) {
    return res.status(400).json({ error: '该 Git 仓库已存在' })
  }

  const isValid = await validateGitRepo(git_url, 'main')
  if (!isValid) {
    return res.status(400).json({ error: 'Git 仓库无效或分支不存在' })
  }

  // 从 Git URL 中提取仓库名称
  const repoName = git_url.split('/').pop()?.replace(/\.git$/, '') || 'unknown'

  const project = await prisma.project.create({
    data: { name: repoName, gitUrl: git_url, cloneMethod: clone_method || 'http', description }
  })
  res.json(toSnakeCase(project))
})

router.put('/:id', authMiddleware, async (req, res) => {
  const project = await prisma.project.update({
    where: { id: Number(req.params.id) },
    data: req.body
  })
  res.json(toSnakeCase(project))
})

router.delete('/:id', authMiddleware, async (req, res) => {
  await prisma.project.delete({ where: { id: Number(req.params.id) } })
  res.json({ success: true })
})

// 打开构建对话框时调用：先同步代码，再返回最新分支、flavor、JDK 信息
router.get('/:id/build-options', authMiddleware, async (req, res) => {
  const defaultTasks = ['assembleDebug', 'assembleRelease']

  try {
    const project = await prisma.project.findUnique({ where: { id: Number(req.params.id) } })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const config = getConfig()
    const repoDir = paths.projectRepo(config.workspaceDir, project.id)

    let synced = false
    let syncError = ''

    // 1. 同步代码
    if (fs.existsSync(repoDir)) {
      try {
        // 修正 refspec，确保浅克隆的仓库也能拉到所有分支
        await execAsync(
          `git -C "${repoDir}" config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'`,
          { timeout: 10000 }
        )
        await execAsync(`git -C "${repoDir}" fetch --all --prune 2>/dev/null`, { timeout: 30000 })
        synced = true
      } catch (e) {
        syncError = (e as Error).message
      }
    } else {
      // 仓库还没克隆，初始化并拉取所有分支引用
      try {
        fs.mkdirSync(repoDir, { recursive: true })
        await execAsync(`git -C "${repoDir}" init 2>/dev/null`, { timeout: 10000 })
        await execAsync(`git -C "${repoDir}" remote add origin "${project.gitUrl}"`, { timeout: 10000 })
        await execAsync(`git -C "${repoDir}" fetch --all --prune 2>/dev/null`, { timeout: 60000 })
        synced = true
      } catch (e) {
        syncError = (e as Error).message
      }
    }

    // 2. 读取分支列表
    let branches: string[] = []
    if (fs.existsSync(repoDir)) {
      try {
        const { stdout } = await execAsync(`git -C "${repoDir}" branch -r`)
        branches = stdout
          .split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.includes('HEAD'))
          .map(l => l.replace(/^origin\//, ''))
      } catch {}
    }
    if (branches.length === 0) {
      // fetch 失败时降级到 ls-remote
      try {
        const { stdout } = await execAsync(`git ls-remote --heads "${project.gitUrl}"`, { timeout: 15000 })
        branches = stdout
          .split('\n')
          .filter(Boolean)
          .map(l => { const m = l.match(/refs\/heads\/(.+)$/); return m ? m[1] : '' })
          .filter(Boolean)
      } catch {}
    }
    if (branches.length === 0) branches = ['main', 'master']

    res.json({ branches, synced, syncError })
  } catch (e) {
    res.json({ branches: ['main', 'master'], synced: false, syncError: (e as Error).message })
  }
})

// 解析指定分支的 flavor 和构建任务（通过 git show 读取，无需 checkout）
router.get('/:id/branch-flavors', authMiddleware, async (req, res) => {
  const defaultTasks = ['assembleDebug', 'assembleRelease']
  const branch = (req.query.branch as string) || 'main'

  try {
    const project = await prisma.project.findUnique({ where: { id: Number(req.params.id) } })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const config = getConfig()
    const repoDir = paths.projectRepo(config.workspaceDir, project.id)

    if (!fs.existsSync(repoDir)) {
      return res.json({ flavors: [], tasks: defaultTasks })
    }

    // 收集所有可能包含 productFlavors 的 gradle 文件
    // 优先搜索独立的 flavor 定义文件（如 script/flavors.gradle）
    const ref = (p: string) => `origin/${branch}:${p}`
    const candidates = [
      ref('script/flavors.gradle'),
      ref('script/flavors.gradle.kts'),
      ref('app/build.gradle'),
      ref('app/build.gradle.kts'),
    ]

    // 列出根目录下的子目录，追加更多候选路径
    try {
      const { stdout } = await execAsync(
        `git -C "${repoDir}" ls-tree --name-only "origin/${branch}"`,
        { timeout: 10000 }
      )
      for (const name of stdout.split('\n').filter(Boolean)) {
        if (!['app', '.git', 'script'].includes(name)) {
          candidates.push(ref(`${name}/build.gradle`))
          candidates.push(ref(`${name}/build.gradle.kts`))
        }
      }
    } catch {}

    // 逐个读取候选文件，解析 productFlavors
    const flavors: string[] = []
    for (const candidate of candidates) {
      let content = ''
      try {
        const { stdout } = await execAsync(
          `git -C "${repoDir}" show "${candidate}"`,
          { timeout: 10000 }
        )
        content = stdout
      } catch { continue }

      const blockMatch = content.match(/productFlavors\s*\{([\s\S]*?)\n\s*\}/m)
      if (!blockMatch) continue
      const block = blockMatch[1]

      // Groovy DSL: 'J177' { ... } 或 "J177" { ... } 或 J177 { ... }
      for (const m of block.matchAll(/^\s*['"]?(\w+)['"]?\s*\{/gm)) {
        if (!flavors.includes(m[1])) flavors.push(m[1])
      }
      // Kotlin DSL: create("X") / register("X") / getByName("X")（排除 signingConfigs.getByName 等链式调用）
      for (const m of block.matchAll(/(?<!\.)(?:create|register|getByName)\s*\(\s*["'](\w+)["']/g)) {
        if (!flavors.includes(m[1])) flavors.push(m[1])
      }

      if (flavors.length > 0) break
    }

    const tasks = flavors.length === 0
      ? defaultTasks
      : flavors.flatMap(f =>
          ['Debug', 'Release'].map(t => `assemble${f.charAt(0).toUpperCase() + f.slice(1)}${t}`)
        )

    res.json({ flavors, tasks })
  } catch {
    res.json({ flavors: [], tasks: defaultTasks })
  }
})

router.post('/validate-git', authMiddleware, async (req, res) => {
  const { git_url, branch } = req.body

  try {
    const isValid = await validateGitRepo(git_url, branch || 'main')
    if (isValid) {
      res.json({ valid: true, message: 'Git 仓库验证成功' })
    } else {
      res.status(400).json({ valid: false, message: 'Git 仓库不存在或分支不存在' })
    }
  } catch (error) {
    res.status(400).json({
      valid: false,
      message: `验证失败: ${(error as Error).message}`
    })
  }
})

export default router
