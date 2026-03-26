<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { buildApi } from '../api'
import type { BuildLog } from '../types'

const route = useRoute()
const router = useRouter()
const buildId = Number(route.params.id)
const logs = ref<BuildLog[]>([])
const loading = ref(false)
let ws: WebSocket | null = null

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await buildApi.getLogs(buildId)
    logs.value = data
  } finally {
    loading.value = false
  }

  // Connect WebSocket for real-time logs
  ws = new WebSocket('ws://localhost:3000/ws')

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.buildId === buildId) {
      logs.value.push({
        id: Date.now(),
        build_id: message.buildId,
        log_type: message.logType,
        content: message.content,
        timestamp: message.timestamp
      })
    }
  }
})

onUnmounted(() => {
  if (ws) {
    ws.close()
  }
})
</script>

<template>
  <div>
    <div style="margin-bottom: 20px">
      <el-button @click="router.back()" style="margin-bottom: 10px">← 返回</el-button>
      <h1 style="margin: 0; font-size: 28px; color: #2c3e50">构建日志 #{{ buildId }}</h1>
    </div>

    <el-card v-loading="loading" shadow="never" :body-style="{ padding: 0 }">
      <div style="background: #1e1e1e; color: #d4d4d4; padding: 20px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; line-height: 1.6; height: 70vh; overflow-y: auto">
        <div v-for="log in logs" :key="log.id" :style="{ color: log.log_type === 'stderr' ? '#f48771' : '#d4d4d4' }">
          {{ log.content }}
        </div>
        <div v-if="logs.length === 0" style="color: #6a9955; text-align: center; padding: 40px">
          # 暂无日志输出
        </div>
      </div>
    </el-card>
  </div>
</template>
