<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'
import type { Project } from '../types'
import EmptyState from '../components/EmptyState.vue'
import StatCard from '../components/StatCard.vue'

const router = useRouter()
const projectStore = useProjectStore()

onMounted(() => {
  projectStore.fetchProjects()
})

const viewProject = (project: Project) => {
  router.push(`/projects/${project.id}`)
}
</script>

<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px">
      <div>
        <h1 style="margin: 0; font-size: 28px; color: #2c3e50">所有项目</h1>
        <p style="margin: 5px 0 0 0; color: #666">共 {{ projectStore.projects.length }} 个项目</p>
      </div>
      <el-button type="primary" size="large" @click="$router.push('/projects/new')">+ 新建项目</el-button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px">
      <StatCard title="总项目数" :value="projectStore.projects.length" icon="📦" color="#409eff" />
      <StatCard title="今日构建" value="0" icon="🚀" color="#67c23a" />
      <StatCard title="成功率" value="0%" icon="✅" color="#e6a23c" />
    </div>

    <div v-loading="projectStore.loading" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px">
      <el-card v-for="project in projectStore.projects" :key="project.id" shadow="hover" style="cursor: pointer" @click="viewProject(project)">
        <div style="display: flex; align-items: center; margin-bottom: 15px">
          <div style="width: 50px; height: 50px; background: #409eff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-right: 15px">
            📦
          </div>
          <div style="flex: 1">
            <h3 style="margin: 0; font-size: 18px; color: #2c3e50">{{ project.name }}</h3>
            <p style="margin: 5px 0 0 0; color: #999; font-size: 13px">{{ project.description || '暂无描述' }}</p>
          </div>
        </div>
      </el-card>
    </div>

    <EmptyState v-if="!projectStore.loading && projectStore.projects.length === 0" icon="📦" title="还没有项目" description="点击右上角新建项目按钮创建第一个项目" />
  </div>
</template>