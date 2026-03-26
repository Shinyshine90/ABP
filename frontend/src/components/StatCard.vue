<script setup lang="ts">
defineProps<{
  title: string
  value: number | string
  icon: string
  color?: string
}>()
</script>

<template>
  <el-card shadow="hover">
    <div style="display: flex; align-items: center; justify-content: space-between">
      <div>
        <p style="color: #999; font-size: 14px; margin-bottom: 8px">{{ title }}</p>
        <h2 style="margin: 0; font-size: 32px; font-weight: bold" :style="{ color: color || '#2c3e50' }">{{ value }}</h2>
      </div>
      <div style="font-size: 48px; opacity: 0.3">{{ icon }}</div>
    </div>
  </el-card>
</template>
