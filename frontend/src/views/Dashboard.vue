<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import StatCard from '../components/StatCard.vue'
import { statsApi } from '../api'

const stats = ref({
  totalBuilds: 0,
  successRate: 0,
  todayBuilds: 0,
  avgDuration: '0秒'
})

const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await statsApi.get()
    stats.value = {
      totalBuilds: data.total_builds,
      successRate: data.success_rate,
      todayBuilds: data.today_builds,
      avgDuration: data.avg_duration
    }
  } catch {
    ElMessage.error('加载统计数据失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <h1 style="margin: 0 0 30px 0; font-size: 28px; color: #2c3e50">构建统计</h1>

    <div v-loading="loading" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px">
      <StatCard title="总构建次数" :value="stats.totalBuilds" icon="🚀" color="#409eff" />
      <StatCard title="成功率" :value="`${stats.successRate}%`" icon="✅" color="#67c23a" />
      <StatCard title="今日构建" :value="stats.todayBuilds" icon="📊" color="#e6a23c" />
      <StatCard title="平均耗时" :value="stats.avgDuration" icon="⏱️" color="#909399" />
    </div>
  </div>
</template>
