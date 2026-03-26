<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { settingsApi } from '../api'

const settings = ref({
  workspaceDir: '/tmp/apk-builds',
  sudoPassword: ''
})

const envStatus = ref({
  git: { installed: false, version: '' },
  jdk: { installed: false, version: '' },
  androidSdk: { installed: false, version: '' }
})

const checking = ref(false)
const installing = ref(false)
const installDialogVisible = ref(false)
const installProgress = ref<{ tool: string; status: string; progress: number }[]>([])

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

const cacheInfo = ref({
  total_size_mb: 0,
  repos: { size_mb: 0 },
  builds: { size_mb: 0, count: 0, failed_count: 0, running_count: 0 },
  sdk_manager: { size_mb: 0 },
  temp: { size_mb: 0 }
})

const clearDialogVisible = ref(false)
const clearTarget = ref('builds')
const clearStrategy = ref('failed')
const clearDays = ref(7)

const sshKey = ref('')

onMounted(async () => {
  try {
    const { data } = await settingsApi.get()
    settings.value = data
  } catch {
    ElMessage.error('加载设置失败')
  }

  try {
    const { data } = await settingsApi.getVersions()
    versions.value = {
      git: data.git,
      jdk: data.jdk,
      androidSdk: data.android_sdk
    }
    selectedVersions.value = {
      git: data.git[0],
      jdk: data.jdk[0],
      androidSdk: data.android_sdk[0]
    }
  } catch {
    ElMessage.error('加载版本列表失败')
  }

  await checkEnvironmentSilent()
  await loadCacheInfo()
  await loadSshKey()
})

const loadSshKey = async () => {
  try {
    const { data } = await settingsApi.getSshKey()
    sshKey.value = data.public_key
  } catch {
    ElMessage.error('加载 SSH 密钥失败')
  }
}

const checkEnvironment = async () => {
  checking.value = true
  try {
    const { data } = await settingsApi.checkEnv()
    envStatus.value = data
    ElMessage.success('环境检测完成')
  } catch {
    ElMessage.error('环境检测失败')
  } finally {
    checking.value = false
  }
}

const checkEnvironmentSilent = async () => {
  try {
    const { data } = await settingsApi.checkEnv()
    envStatus.value = data
  } catch {}
}

const openInstallDialog = () => {
  if (versions.value.git.length === 0) {
    ElMessage.warning('版本数据加载中，请稍后再试')
    return
  }
  installDialogVisible.value = true
}

const startInstall = async () => {
  installing.value = true
  installProgress.value = [
    { tool: 'Git', status: '准备安装...', progress: 0 },
    { tool: 'JDK', status: '等待中...', progress: 0 },
    { tool: 'Android SDK', status: '等待中...', progress: 0 }
  ]

  try {
    const response = await fetch('http://localhost:3000/api/settings/install-env', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        git_version: selectedVersions.value.git,
        jdk_version: selectedVersions.value.jdk,
        android_sdk_version: selectedVersions.value.androidSdk
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
          const idx = installProgress.value.findIndex(p => p.tool === data.tool)
          if (idx >= 0) {
            installProgress.value[idx] = data
          }
        } catch {}
      }
    }

    ElMessage.success('环境安装完成')
    await checkEnvironment()
    installDialogVisible.value = false
  } catch (error) {
    ElMessage.error('安装失败')
  } finally {
    installing.value = false
  }
}

const handleSave = async () => {
  try {
    await settingsApi.update(settings.value)
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

const loadCacheInfo = async () => {
  try {
    const { data } = await settingsApi.getCacheInfo()
    cacheInfo.value = data
  } catch {
    ElMessage.error('加载缓存信息失败')
  }
}

const openClearDialog = () => {
  clearDialogVisible.value = true
}

const confirmClear = async () => {
  try {
    await ElMessageBox.confirm('确定要清理缓存吗？此操作不可恢复。', '警告', { type: 'warning' })
    const { data } = await settingsApi.clearCache({
      target: clearTarget.value,
      strategy: clearStrategy.value,
      days: clearDays.value
    })
    ElMessage.success(`清理完成，删除 ${data.deleted_count} 个构建，释放 ${data.freed_space_mb} MB`)
    clearDialogVisible.value = false
    await loadCacheInfo()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('清理失败')
    }
  }
}
</script>

<template>
  <div>
    <h1 style="margin-bottom: 30px; font-size: 28px; color: #2c3e50">系统设置</h1>

    <el-card shadow="never" style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: bold">环境检测</span>
          <div>
            <el-button type="primary" :loading="checking" @click="checkEnvironment">检测环境</el-button>
            <el-button type="success" @click="$router.push('/environment-setup')" style="margin-left: 10px">环境部署</el-button>
          </div>
        </div>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="Git">
          <span v-if="envStatus.git.installed" style="color: #67c23a">✓ 已安装 {{ envStatus.git.version }}</span>
          <span v-else style="color: #f56c6c">✗ 未安装</span>
        </el-descriptions-item>
        <el-descriptions-item label="JDK">
          <span v-if="envStatus.jdk.installed" style="color: #67c23a">✓ 已安装 {{ envStatus.jdk.version }}</span>
          <span v-else style="color: #f56c6c">✗ 未安装</span>
        </el-descriptions-item>
        <el-descriptions-item label="Android SDK">
          <span v-if="envStatus.androidSdk.installed" style="color: #67c23a">✓ 已安装 {{ envStatus.androidSdk.version }}</span>
          <span v-else style="color: #f56c6c">✗ 未安装</span>
        </el-descriptions-item>
      </el-descriptions>

      <div v-if="installing" style="margin-top: 20px">
        <div v-for="item in installProgress" :key="item.tool" style="margin-bottom: 15px">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px">
            <span>{{ item.tool }}</span>
            <span style="color: #909399">{{ item.status }}</span>
          </div>
          <el-progress :percentage="item.progress" :status="item.progress === 100 ? 'success' : undefined" />
        </div>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <template #header>
        <span style="font-weight: bold">SSH 公钥</span>
      </template>
      <el-input v-model="sshKey" type="textarea" :rows="4" readonly />
      <el-button style="margin-top: 10px" @click="navigator.clipboard.writeText(sshKey); ElMessage.success('已复制到剪贴板')">复制公钥</el-button>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <template #header>
        <span style="font-weight: bold">路径配置</span>
      </template>
      <el-form :model="settings" label-width="150px">
        <el-form-item label="工作目录">
          <el-input v-model="settings.workspaceDir" placeholder="/tmp/apk-builds" />
        </el-form-item>
        <el-form-item label="管理员密码">
          <el-input v-model="settings.sudoPassword" type="password" placeholder="用于 sudo 命令" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSave">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: bold">缓存管理</span>
          <div>
            <el-button @click="loadCacheInfo">刷新</el-button>
            <el-button type="danger" @click="openClearDialog">清理</el-button>
          </div>
        </div>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="总占用">{{ cacheInfo.total_size_mb }} MB</el-descriptions-item>
        <el-descriptions-item label="Git 仓库">{{ cacheInfo.repos.size_mb }} MB</el-descriptions-item>
        <el-descriptions-item label="构建输出">{{ cacheInfo.builds.size_mb }} MB ({{ cacheInfo.builds.count }} 个)</el-descriptions-item>
        <el-descriptions-item label="SDK Manager">{{ cacheInfo.sdk_manager.size_mb }} MB</el-descriptions-item>
        <el-descriptions-item label="临时文件">{{ cacheInfo.temp.size_mb }} MB</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-dialog v-model="installDialogVisible" title="配置安装环境" width="500px" :close-on-click-modal="false">
      <div v-if="!installing">
        <el-form label-width="120px">
          <el-form-item label="Git 版本">
            <el-select v-model="selectedVersions.git" style="width: 100%">
              <el-option v-for="v in versions.git" :key="v" :label="v + (v === versions.git[0] ? ' (推荐)' : '')" :value="v" />
            </el-select>
          </el-form-item>
          <el-form-item label="JDK 版本">
            <el-select v-model="selectedVersions.jdk" style="width: 100%">
              <el-option v-for="v in versions.jdk" :key="v" :label="v + (v === versions.jdk[0] ? ' (推荐)' : '')" :value="v" />
            </el-select>
          </el-form-item>
          <el-form-item label="Android SDK">
            <el-select v-model="selectedVersions.androidSdk" style="width: 100%">
              <el-option v-for="v in versions.androidSdk" :key="v" :label="v + (v === versions.androidSdk[0] ? ' (推荐)' : '')" :value="v" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <div v-else>
        <div v-for="item in installProgress" :key="item.tool" style="margin-bottom: 15px">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px">
            <span>{{ item.tool }}</span>
            <span style="color: #909399">{{ item.status }}</span>
          </div>
          <el-progress :percentage="item.progress" :status="item.progress === 100 ? 'success' : undefined" />
        </div>
      </div>
      <template #footer>
        <el-button @click="installDialogVisible = false" :disabled="installing">取消</el-button>
        <el-button type="primary" @click="startInstall" :loading="installing">开始安装</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="clearDialogVisible" title="清理缓存" width="400px">
      <el-form label-width="100px">
        <el-form-item label="清理目标">
          <el-radio-group v-model="clearTarget">
            <el-radio label="builds">构建输出</el-radio>
            <el-radio label="temp">临时文件</el-radio>
            <el-radio label="all">全部</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="clearTarget === 'builds' || clearTarget === 'all'" label="清理策略">
          <el-radio-group v-model="clearStrategy">
            <el-radio label="failed">仅失败的构建</el-radio>
            <el-radio label="old">旧构建</el-radio>
            <el-radio label="all">所有构建</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="(clearTarget === 'builds' || clearTarget === 'all') && clearStrategy === 'old'" label="保留天数">
          <el-input-number v-model="clearDays" :min="1" :max="365" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="clearDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmClear">确认清理</el-button>
      </template>
    </el-dialog>
  </div>
</template>
