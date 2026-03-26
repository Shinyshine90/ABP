<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { buildApi } from '../api'
import type { BuildTask } from '../types'

const router = useRouter()
const allBuilds = ref<any[]>([])
const loading = ref(false)

const statusConfig: Record<string, { icon: string; color: string; text: string }> = {
  pending: { icon: '⏳', color: '#909399', text: '等待中' },
  running: { icon: '🔄', color: '#e6a23c', text: '构建中' },
  success: { icon: '✅', color: '#67c23a', text: '成功' },
  failed: { icon: '❌', color: '#f56c6c', text: '失败' }
}

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await buildApi.getAll()
    allBuilds.value = data
  } catch {
    ElMessage.error('加载构建历史失败')
  } finally {
    loading.value = false
  }
})

const viewLogs = (id: number) => {
  router.push(`/builds/${id}/logs`)
}
</script>

<template>
  <div>
    <h1 style="margin: 0 0 30px 0; font-size: 28px; color: #2c3e50">全部构建历史</h1>

    <el-card shadow="never" v-loading="loading">
      <el-table :data="allBuilds">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="项目" width="200">
          <template #default="{ row }">
            {{ row.project?.name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <span :style="{ color: statusConfig[row.status].color }">
              {{ statusConfig[row.status].icon }} {{ statusConfig[row.status].text }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="git_commit" label="Commit" width="100">
          <template #default="{ row }">
            {{ row.git_commit?.substring(0, 7) || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="started_at" label="构建时间" />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="viewLogs(row.id)">查看日志</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
