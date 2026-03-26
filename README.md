# APK 构建平台

安卓 APK 自动化构建平台，支持 Git 仓库管理、自动构建、日志查看。

## 项目状态

**前端完成度：90%** | **后端完成度：100%** | **整体完成度：95%**

### ✅ 已完成
- 后端所有核心 API（已测试通过）
- 前端所有页面和组件
- 用户认证系统（JWT）
- 项目管理功能（CRUD + Git 仓库验证）
- 构建任务触发和日志收集
- 数据库模型和 ORM（SQLite）
- 前后端联调（已打通）
- 系统设置（工作目录、JDK、SDK 配置）
- 字段格式转换（camelCase ↔ snake_case）

### ⏳ 待完成
- WebSocket 实时日志推送
- APK 文件存储和下载
- Docker 构建环境隔离
- 构建任务队列管理
- 统计数据 API 实现

## 技术栈

### 前端
- Vue 3 + TypeScript
- Element Plus
- Pinia + Vue Router
- Vite

### 后端
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT 认证

## 快速开始

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

### 后端

1. 安装依赖
```bash
cd backend
npm install
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 配置数据库连接
```

3. 初始化数据库
```bash
npm run db:push
```

4. 启动服务
```bash
npm run dev
```

服务运行在 http://localhost:3000

## 功能特性

- 项目管理：创建、查看、编辑项目
- 构建任务：触发构建、查看构建历史
- 实时日志：查看构建过程日志
- 统计面板：构建数据统计
- 用户认证：JWT 登录认证

## API 接口

```
POST   /api/auth/login          # 登录
POST   /api/auth/register       # 注册

GET    /api/projects            # 获取项目列表
POST   /api/projects            # 创建项目（自动验证 Git 仓库）
GET    /api/projects/:id        # 获取项目详情
PUT    /api/projects/:id        # 更新项目
DELETE /api/projects/:id        # 删除项目

GET    /api/projects/:id/builds # 获取项目构建历史
POST   /api/builds              # 触发构建
GET    /api/builds/:id          # 获取构建详情
GET    /api/builds/:id/logs     # 获取构建日志

GET    /api/settings            # 获取系统设置
PUT    /api/settings            # 更新系统设置
```

## 使用说明

1. 首次使用请先注册账号或使用测试账号：admin / admin123
2. 在设置页面配置项目存储路径和构建环境
3. 创建项目时会自动验证 Git 仓库是否可访问
4. 触发构建后可在构建历史中查看日志

