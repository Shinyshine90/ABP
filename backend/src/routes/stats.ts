import { Router } from 'express'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  const totalBuilds = await prisma.build.count()
  const successBuilds = await prisma.build.count({ where: { status: 'success' } })
  const successRate = totalBuilds > 0 ? Math.round((successBuilds / totalBuilds) * 100) : 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayBuilds = await prisma.build.count({
    where: { startedAt: { gte: today } }
  })

  const completedBuilds = await prisma.build.findMany({
    where: { finishedAt: { not: null }, startedAt: { not: null } }
  })

  let avgDuration = '0秒'
  if (completedBuilds.length > 0) {
    const totalMs = completedBuilds.reduce((sum, build) => {
      return sum + (new Date(build.finishedAt!).getTime() - new Date(build.startedAt!).getTime())
    }, 0)
    const avgMs = totalMs / completedBuilds.length
    const minutes = Math.floor(avgMs / 60000)
    const seconds = Math.floor((avgMs % 60000) / 1000)
    avgDuration = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`
  }

  res.json({
    total_builds: totalBuilds,
    success_rate: successRate,
    today_builds: todayBuilds,
    avg_duration: avgDuration
  })
})

export default router
