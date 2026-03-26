import { Router } from 'express'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { toSnakeCase } from '../utils/transform.js'
import { validateGitRepo } from '../utils/git.js'

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
  const { name, git_url, clone_method, description } = req.body

  const isValid = await validateGitRepo(git_url, 'main')
  if (!isValid) {
    return res.status(400).json({ error: 'Git 仓库无效或分支不存在' })
  }

  const project = await prisma.project.create({
    data: { name, gitUrl: git_url, cloneMethod: clone_method || 'http', description }
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
