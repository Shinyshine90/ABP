<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { projectApi } from '../api'

const router = useRouter()

const form = ref({
  name: '',
  gitUrl: '',
  cloneMethod: 'http',
  description: ''
})

const validating = ref(false)
const creating = ref(false)

const handleSubmit = async () => {
  if (!form.value.name || !form.value.gitUrl) {
    ElMessage.warning('请填写项目名称和 Git 仓库地址')
    return
  }

  validating.value = true
  try {
    await projectApi.validateGit(form.value.gitUrl, 'main')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || 'Git 仓库验证失败')
    validating.value = false
    return
  }
  validating.value = false

  creating.value = true
  try {
    const { data } = await projectApi.create({
      name: form.value.name,
      git_url: form.value.gitUrl,
      clone_method: form.value.cloneMethod,
      description: form.value.description
    })
    ElMessage.success('项目创建成功')
    router.push(`/projects/${data.id}`)
  } catch {
    ElMessage.error('项目创建失败')
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div style="padding: 20px">
    <h1 style="margin-bottom: 30px; font-size: 28px; color: #2c3e50">新建项目</h1>
    <el-card shadow="never" style="max-width: 800px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="项目名称" required>
          <el-input v-model="form.name" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="Git 仓库" required>
          <el-input v-model="form.gitUrl" placeholder="https://github.com/user/repo.git" />
        </el-form-item>
        <el-form-item label="克隆方式">
          <el-radio-group v-model="form.cloneMethod">
            <el-radio label="http">HTTP</el-radio>
            <el-radio label="ssh">SSH</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="项目描述（可选）" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="validating || creating">
            {{ validating ? '验证中...' : creating ? '创建中...' : '验证并创建' }}
          </el-button>
          <el-button @click="router.push('/projects')">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
