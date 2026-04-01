import { WebSocketServer, WebSocket } from 'ws'
import { Server } from 'http'

let wss: WebSocketServer

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected')

    ws.on('close', () => {
      console.log('WebSocket client disconnected')
    })
  })
}

export function broadcastLog(buildId: number, logType: string, content: string) {
  if (!wss) return

  const message = JSON.stringify({ type: 'log', buildId, logType, content, timestamp: new Date() })

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

export function broadcastBuildStatus(buildId: number, status: string) {
  if (!wss) return

  const message = JSON.stringify({ type: 'status', buildId, status, timestamp: new Date() })

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}
