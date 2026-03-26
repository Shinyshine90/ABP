import { Router } from 'express'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { startBuild } from '../services/build.js'
import { toSnakeCase } from '../utils/transform.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  const page = Number(req.query.page) || 1
  const limit = Number(req.query.limit) || 20
  const skip = (page - 1) * limit

  const builds = await prisma.build.findMany({
    include: { project: true },
    orderBy: { startedAt: 'desc' },
    skip,
    take: limit
  })
  res.json(toSnakeCase(builds))
})

router.post('/', authMiddleware, async (req, res) => {
  const { project_id, branch, gradle_task } = req.body
  const build = await prisma.build.create({
    data: {
      projectId: project_id,
      branch: branch || 'main',
      gradleTask: gradle_task || 'assembleRelease',
      status: 'pending',
      createdBy: req.user.username
    }
  })
  startBuild(build.id)
  res.json(toSnakeCase(build))
})

router.get('/:id', authMiddleware, async (req, res) => {
  const build = await prisma.build.findUnique({
    where: { id: Number(req.params.id) },
    include: { project: true }
  })
  res.json(toSnakeCase(build))
})

router.get('/:id/logs', authMiddleware, async (req, res) => {
  const logs = await prisma.buildLog.findMany({
    where: { buildId: Number(req.params.id) },
    orderBy: { timestamp: 'asc' }
  })
  res.json(toSnakeCase(logs))
})

router.get('/:id/download', authMiddleware, async (req, res) => {
  const build = await prisma.build.findUnique({
    where: { id: Number(req.params.id) }
  })

  if (!build || !build.apkPath) {
    return res.status(404).json({ error: 'APK file not found' })
  }

  res.download(build.apkPath)
})

export default router
