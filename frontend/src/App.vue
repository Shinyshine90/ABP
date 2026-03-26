<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const username = ref(localStorage.getItem('username') || '')

const isLoginPage = computed(() => route.path === '/login')

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  ElMessage.success('已退出登录')
  router.push('/login')
}
</script>

<template>
  <div v-if="isLoginPage">
    <router-view />
  </div>
  <el-container v-else style="height: 100vh; background: #f5f5f5">
    <el-header style="background: #2c3e50; color: white; display: flex; align-items: center; justify-content: space-between; padding: 0 20px">
      <h2 style="margin: 0; font-size: 20px">🚀 Android 构建平台</h2>
      <div style="display: flex; align-items: center; gap: 15px">
        <span>👤 {{ username }}</span>
        <el-button size="small" @click="handleLogout">退出</el-button>
      </div>
    </el-header>
    <el-container>
      <el-aside width="220px" style="background: white; border-right: 1px solid #ddd; padding: 20px 0">
        <el-menu router :default-active="$route.path" style="border: none">
          <el-menu-item index="/projects">
            <span style="font-size: 15px">📦 项目列表</span>
          </el-menu-item>
          <el-menu-item index="/dashboard">
            <span style="font-size: 15px">📊 构建统计</span>
          </el-menu-item>
          <el-menu-item index="/history">
            <span style="font-size: 15px">📜 构建历史</span>
          </el-menu-item>
          <el-menu-item index="/settings">
            <span style="font-size: 15px">⚙️ 系统设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main style="background: #f5f5f5; padding: 30px">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
