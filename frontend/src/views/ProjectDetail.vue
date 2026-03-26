<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { buildApi, projectApi } from '../api'
import { ElMessage } from 'element-plus'
import type { BuildTask, Project } from '../types'

const route = useRoute()
const router = useRouter()
const projectId = Number(route.params.id)
const project = ref<Project | null>(null)
const builds = ref<BuildTask[]>([])
const loading = ref(false)
const buildDialogVisible = ref(false)
const buildForm = ref({
  branch: '',
  gradle_task: ''
})

const branches = ['main', 'develop', 'release', 'feature/new-ui']
const gradleTasks = ['assembleDebug', 'assembleRelease', 'assembleProductionRelease', 'assembleStagingDebug']

const statusConfig: Record<string, { icon: string; color: string; text: string }> = {
  pending: { icon: '⏳', color: '#909399', text: '等待中' },
  running: { icon: '🔄', color: '#e6a23c', text: '构建中' },
  success: { icon: '✅', color: '#67c23a', text: '成功' },
  failed: { icon: '❌', color: '#f56c6c', text: '失败' }
}

onMounted(async () => {
  await Promise.all([fetchProject(), fetchBuilds()])
})

const fetchProject = async () => {
  try {
    const { data } = await projectApi.getById(projectId)
    project.value = data
  } catch {
    ElMessage.error('加载项目信息失败')
  }
}

const fetchBuilds = async () => {
  loading.value = true
  try {
    const { data } = await buildApi.getByProject(projectId)
    builds.value = data
  } catch (error) {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const openBuildDialog = () => {
  buildForm.value = { branch: 'main', gradle_task: 'assembleRelease' }
  buildDialogVisible.value = true
}

const triggerBuild = async () => {
  try {
    await buildApi.create(projectId, buildForm.value.branch, buildForm.value.gradle_task)
    ElMessage.success('构建已触发')
    buildDialogVisible.value = false
    await fetchBuilds()
  } catch (error) {
    ElMessage.error('触发失败')
  }
}

const viewLogs = (buildId: number) => {
  router.push(`/builds/${buildId}/logs`)
}

const downloadApk = (buildId: number) => {
  window.open(`http://localhost:3000/api/builds/${buildId}/download`, '_blank')
}
</script>

<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px">
      <div>
        <h1 style="margin: 0; font-size: 28px; color: #2c3e50">{{ project?.name || '项目详情' }}</h1>
        <p style="margin: 5px 0 0 0; color: #666">项目 #{{ projectId }}</p>
      </div>
      <el-button type="primary" size="large" @click="openBuildDialog">🚀 立即构建</el-button>
    </div>

    <el-card shadow="never" style="margin-bottom: 20px">
      <template #header>
        <span style="font-weight: bold">项目配置</span>
      </template>
      <el-descriptions v-if="project" :column="1" border>
        <el-descriptions-item label="项目名称">{{ project.name }}</el-descriptions-item>
        <el-descriptions-item label="Git 仓库">{{ project.git_url }}</el-descriptions-item>
        <el-descriptions-item label="克隆方式">{{ project.clone_method === 'ssh' ? 'SSH' : 'HTTP' }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ project.description || '暂无描述' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-loading="loading" shadow="never">
      <div v-for="build in builds" :key="build.id" style="padding: 20px; border-bottom: 1px solid #eee; display: flex; align-items: center; cursor: pointer" @click="viewLogs(build.id)">
        <div style="font-size: 32px; margin-right: 20px">{{ statusConfig[build.status].icon }}</div>
        <div style="flex: 1">
          <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 8px">
            <h3 style="margin: 0; font-size: 16px">构建 #{{ build.id }}</h3>
            <span :style="{ color: statusConfig[build.status].color, fontWeight: 'bold' }">{{ statusConfig[build.status].text }}</span>
            <span v-if="build.version" style="background: #ecf5ff; color: #409eff; padding: 2px 8px; border-radius: 4px; font-size: 12px">{{ build.version }}</span>
          </div>
          <div style="font-size: 13px; color: #999">
            <span v-if="build.git_commit">Commit: {{ build.git_commit.substring(0, 7) }}</span>
            <span v-if="build.started_at" style="margin-left: 20px">{{ build.started_at }}</span>
          </div>
        </div>
        <div style="display: flex; gap: 10px">
          <el-button v-if="build.status === 'success'" type="success" @click.stop="downloadApk(build.id)">下载 APK</el-button>
          <el-button type="primary" link @click.stop="viewLogs(build.id)">查看日志 →</el-button>
        </div>
      </div>
      <div v-if="builds.length === 0" style="text-align: center; padding: 60px; color: #999">
        暂无构建记录，点击"立即构建"开始第一次构建
      </div>
    </el-card>

    <el-dialog v-model="buildDialogVisible" title="配置构建" width="400px">
      <el-form :model="buildForm" label-width="100px">
        <el-form-item label="分支">
          <el-input v-model="buildForm.branch" placeholder="main" />
        </el-form-item>
        <el-form-item label="构建任务">
          <el-input v-model="buildForm.gradle_task" placeholder="assembleRelease" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="buildDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="triggerBuild">开始构建</el-button>
      </template>
    </el-dialog>
  </div>
</template>
