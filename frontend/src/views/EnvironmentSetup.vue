<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { settingsApi } from '../api'

const router = useRouter()

const envStatus = ref({
  git: { installed: false, version: '' },
  jdk: { installed: false, version: '' },
  androidSdk: { installed: false, version: '' }
})

const versions = ref({
  git: [] as string[],
  jdk: [] as string[],
  androidSdk: [] as string[]
})

const selectedVersions = ref({
  git: '',
  jdk: '',
  androidSdk: ''
})

const installing = ref({
  git: false,
  jdk: false,
  androidSdk: false
})

const progress = ref({
  git: { percent: 0, message: '', logs: [] as string[] },
  jdk: { percent: 0, message: '', logs: [] as string[] },
  androidSdk: { percent: 0, message: '', logs: [] as string[] }
})

const logRefs = ref<{ [key: string]: HTMLElement | null }>({
  git: null,
  jdk: null,
  androidSdk: null
})

watch(() => progress.value.git.logs.length, () => {
  nextTick(() => logRefs.value.git?.scrollTo({ top: 999999, behavior: 'smooth' }))
})
watch(() => progress.value.jdk.logs.length, () => {
  nextTick(() => logRefs.value.jdk?.scrollTo({ top: 999999, behavior: 'smooth' }))
})
watch(() => progress.value.androidSdk.logs.length, () => {
  nextTick(() => logRefs.value.androidSdk?.scrollTo({ top: 999999, behavior: 'smooth' }))
})

onMounted(async () => {
  await loadData()
})

const loadData = async () => {
  try {
    const [envData, versionData] = await Promise.all([
      settingsApi.checkEnv(),
      settingsApi.getVersions()
    ])

    envStatus.value = envData.data
    versions.value = {
      git: versionData.data.git,
      jdk: versionData.data.jdk,
      androidSdk: versionData.data.android_sdk
    }
    selectedVersions.value = {
      git: versionData.data.git[0],
      jdk: versionData.data.jdk[0],
      androidSdk: versionData.data.android_sdk[0]
    }
  } catch {
    ElMessage.error('加载数据失败')
  }
}

const installTool = async (tool: 'git' | 'jdk' | 'androidSdk') => {
  installing.value[tool] = true
  progress.value[tool] = { percent: 0, message: '准备安装...', logs: [] }

  try {
    const response = await fetch('http://localhost:3000/api/settings/install-tool', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: tool === 'androidSdk' ? 'android_sdk' : tool,
        version: selectedVersions.value[tool]
      })
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    while (reader) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value)
      const lines = text.split('\n').filter(l => l.trim())

      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          const prevPercent = progress.value[tool].percent
          const prevMessage = progress.value[tool].message

          progress.value[tool].percent = data.progress
          progress.value[tool].message = data.message

          if (data.log) {
            // 只对下载进度条（包含百分比的行）进行替换，其他日志追加
            const isProgressBar = /\d+%/.test(data.log) && prevPercent === data.progress && prevMessage === data.message
            if (isProgressBar && progress.value[tool].logs.length > 0) {
              progress.value[tool].logs[progress.value[tool].logs.length - 1] = data.log
            } else {
              progress.value[tool].logs.push(data.log)
            }
          }
        } catch {}
      }
    }

    ElMessage.success(`${tool.toUpperCase()} 安装完成`)
    await loadData()
  } catch {
    ElMessage.error('安装失败')
  } finally {
    installing.value[tool] = false
  }
}
</script>

<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px">
      <h1 style="margin: 0; font-size: 28px; color: #2c3e50">环境部署</h1>
      <el-button @click="router.push('/settings')">返回设置</el-button>
    </div>

    <el-card shadow="never" style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: bold">Git</span>
          <span v-if="envStatus.git.installed" style="color: #67c23a">✓ 已安装 {{ envStatus.git.version }}</span>
          <span v-else style="color: #f56c6c">✗ 未安装</span>
        </div>
      </template>
      <el-form label-width="100px">
        <el-form-item label="操作">
          <el-button type="primary" :loading="installing.git" @click="installTool('git')">
            {{ envStatus.git.installed ? '重新安装' : '安装最新版' }}
          </el-button>
        </el-form-item>
      </el-form>
      <div v-if="installing.git || progress.git.percent > 0">
        <el-progress :percentage="progress.git.percent" :status="progress.git.percent === 100 ? 'success' : undefined" />
        <div style="margin-top: 10px; color: #909399">{{ progress.git.message }}</div>
        <div v-if="progress.git.logs.length > 0" :ref="el => logRefs.git = el as HTMLElement" style="margin-top: 10px; background: #f5f7fa; padding: 10px; border-radius: 4px; max-height: 400px; overflow-y: auto; overflow-x: auto">
          <div v-for="(log, idx) in progress.git.logs" :key="idx" style="font-size: 12px; font-family: monospace; color: #606266; white-space: nowrap; word-break: keep-all; overflow-wrap: normal">{{ log }}</div>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: bold">JDK</span>
          <span v-if="envStatus.jdk.installed" style="color: #67c23a">✓ 已安装 {{ envStatus.jdk.version }}</span>
          <span v-else style="color: #f56c6c">✗ 未安装</span>
        </div>
      </template>
      <el-form label-width="100px">
        <el-form-item label="版本选择">
          <el-select v-model="selectedVersions.jdk" :disabled="installing.jdk" style="width: 200px">
            <el-option v-for="v in versions.jdk" :key="v" :label="v + (v === versions.jdk[0] ? ' (推荐)' : '')" :value="v" />
          </el-select>
          <el-button type="primary" :loading="installing.jdk" @click="installTool('jdk')" style="margin-left: 10px">
            {{ envStatus.jdk.installed ? '重新安装' : '开始安装' }}
          </el-button>
        </el-form-item>
      </el-form>
      <div v-if="installing.jdk || progress.jdk.percent > 0">
        <el-progress :percentage="progress.jdk.percent" :status="progress.jdk.percent === 100 ? 'success' : undefined" />
        <div style="margin-top: 10px; color: #909399">{{ progress.jdk.message }}</div>
        <div v-if="progress.jdk.logs.length > 0" :ref="el => logRefs.jdk = el as HTMLElement" style="margin-top: 10px; background: #f5f7fa; padding: 10px; border-radius: 4px; max-height: 400px; overflow-y: auto; overflow-x: auto">
          <div v-for="(log, idx) in progress.jdk.logs" :key="idx" style="font-size: 12px; font-family: monospace; color: #606266; white-space: nowrap; word-break: keep-all; overflow-wrap: normal">{{ log }}</div>
        </div>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: bold">Android SDK</span>
          <span v-if="envStatus.androidSdk.installed" style="color: #67c23a">✓ 已安装 {{ envStatus.androidSdk.version }}</span>
          <span v-else style="color: #f56c6c">✗ 未安装</span>
        </div>
      </template>
      <el-form label-width="100px">
        <el-form-item label="操作">
          <el-button type="primary" :loading="installing.androidSdk" @click="installTool('androidSdk')">
            {{ envStatus.androidSdk.installed ? '重新安装' : '安装 SDK Manager' }}
          </el-button>
          <span style="margin-left: 10px; color: #909399; font-size: 12px">安装后 Gradle 会自动下载所需 SDK</span>
        </el-form-item>
      </el-form>
      <div v-if="installing.androidSdk || progress.androidSdk.percent > 0">
        <el-progress :percentage="progress.androidSdk.percent" :status="progress.androidSdk.percent === 100 ? 'success' : undefined" />
        <div style="margin-top: 10px; color: #909399">{{ progress.androidSdk.message }}</div>
        <div v-if="progress.androidSdk.logs.length > 0" :ref="el => logRefs.androidSdk = el as HTMLElement" style="margin-top: 10px; background: #f5f7fa; padding: 10px; border-radius: 4px; max-height: 400px; overflow-y: auto; overflow-x: auto">
          <div v-for="(log, idx) in progress.androidSdk.logs" :key="idx" style="font-size: 12px; font-family: monospace; color: #606266; white-space: nowrap; word-break: keep-all; overflow-wrap: normal">{{ log }}</div>
        </div>
      </div>
    </el-card>
  </div>
</template>



