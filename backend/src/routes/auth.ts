import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../db.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'secret'

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  const user = await prisma.user.findUnique({ where: { username } })

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, username: user.username })
})

router.post('/register', async (req, res) => {
  const { username, password } = req.body
  const hashedPassword = bcrypt.hashSync(password, 10)

  try {
    const user = await prisma.user.create({
      data: { username, password: hashedPassword }
    })
    res.json({ id: user.id, username: user.username })
  } catch {
    res.status(400).json({ error: 'Username already exists' })
  }
})

export default router
