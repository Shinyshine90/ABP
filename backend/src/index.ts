import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import http from 'http'
import authRoutes from './routes/auth.js'
import projectRoutes from './routes/projects.js'
import buildRoutes from './routes/builds.js'
import settingsRoutes from './routes/settings.js'
import statsRoutes from './routes/stats.js'
import { toSnakeCase } from './utils/transform.js'
import { initializeDirectories } from './config.js'
import { initWebSocket } from './websocket.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/builds', buildRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/stats', statsRoutes)

app.get('/api/projects/:id/builds', async (req, res) => {
  const { prisma } = await import('./db.js')
  const builds = await prisma.build.findMany({
    where: { projectId: Number(req.params.id) },
    orderBy: { startedAt: 'desc' }
  })
  res.json(toSnakeCase(builds))
})

async function initDefaultUser() {
  const { prisma } = await import('./db.js')
  const bcrypt = (await import('bcryptjs')).default

  const existingUser = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (!existingUser) {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await prisma.user.create({
      data: { username: 'admin', password: hashedPassword }
    })
    console.log('✓ 默认管理员账号已创建 (admin/admin123)')
  }
}

async function start() {
  await initializeDirectories()
  await initDefaultUser()

  const server = http.createServer(app)
  initWebSocket(server)

  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
    console.log(`WebSocket server running on ws://localhost:${PORT}/ws`)
  })
}

start()
