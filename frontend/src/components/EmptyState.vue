<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div style="text-align: center; padding: 80px 20px; color: #999">
    <div style="font-size: 64px; margin-bottom: 20px">{{ icon || '📭' }}</div>
    <h3 style="color: #666; margin-bottom: 10px">{{ title }}</h3>
    <p v-if="description" style="font-size: 14px">{{ description }}</p>
  </div>
</template>
