<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { buildApi } from '../api'
import type { BuildLog } from '../types'

const route = useRoute()
const router = useRouter()
const buildId = Number(route.params.id)
const logs = ref<BuildLog[]>([])
const loading = ref(false)
const buildStatus = ref<string>('running')
const logContainer = ref<HTMLElement | null>(null)
let ws: WebSocket | null = null
let autoScroll = true

const scrollToBottom = () => {
  if (!autoScroll || !logContainer.value) return
  logContainer.value.scrollTop = logContainer.value.scrollHeight
}

onMounted(async () => {
  loading.value = true
  try {
    const { data: build } = await buildApi.getById(buildId)
    buildStatus.value = build.status
    const { data } = await buildApi.getLogs(buildId)
    logs.value = data
  } finally {
    loading.value = false
    await nextTick()
    scrollToBottom()
  }

  // 如果构建已结束则不连 WebSocket
  if (buildStatus.value !== 'running' && buildStatus.value !== 'pending') return

  ws = new WebSocket('ws://localhost:3000/ws')

  ws.onmessage = async (event) => {
    const message = JSON.parse(event.data)
    if (message.buildId !== buildId) return

    if (message.type === 'status') {
      buildStatus.value = message.status
    } else {
      // 兼容旧格式（type 字段不存在）
      logs.value.push({
        id: Date.now(),
        build_id: message.buildId,
        log_type: message.logType,
        content: message.content,
        timestamp: message.timestamp
      })
      await nextTick()
      scrollToBottom()
    }
  }
})

onUnmounted(() => {
  if (ws) ws.close()
})

const onScroll = () => {
  if (!logContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = logContainer.value
  // 距底部 50px 内认为是自动滚动区
  autoScroll = scrollHeight - scrollTop - clientHeight < 50
}
</script>

<template>
  <div>
    <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 20px">
      <el-button @click="router.back()">← 返回</el-button>
      <h1 style="margin: 0; font-size: 28px; color: #2c3e50">构建日志 #{{ buildId }}</h1>
      <el-tag v-if="buildStatus === 'running'" type="warning" effect="dark">构建中...</el-tag>
      <el-tag v-else-if="buildStatus === 'success'" type="success" effect="dark">✓ 构建成功</el-tag>
      <el-tag v-else-if="buildStatus === 'failed'" type="danger" effect="dark">✗ 构建失败</el-tag>
    </div>

    <el-card v-loading="loading" shadow="never" :body-style="{ padding: 0 }">
      <div
        ref="logContainer"
        @scroll="onScroll"
        style="background: #1e1e1e; color: #d4d4d4; padding: 20px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; line-height: 1.6; height: 70vh; overflow-y: auto; white-space: pre-wrap; word-break: break-all"
      >
        <span
          v-for="log in logs"
          :key="log.id"
          :style="{ color: log.log_type === 'stderr' ? '#f48771' : '#d4d4d4' }"
        >{{ log.content }}</span>
        <div v-if="logs.length === 0 && !loading" style="color: #6a9955; text-align: center; padding: 40px">
          # 暂无日志输出
        </div>
      </div>
    </el-card>
  </div>
</template>
