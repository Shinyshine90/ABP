#!/bin/bash

set -e

echo "🚀 启动 APK 构建平台..."

# 后端
echo "📦 安装后端依赖..."
cd backend
if [ ! -d "node_modules" ]; then
  npm install
fi

echo "🗄️  初始化数据库..."
npm run db:push

echo "🔧 启动后端服务..."
npm run dev &
BACKEND_PID=$!

# 前端
echo "📦 安装前端依赖..."
cd ../frontend
if [ ! -d "node_modules" ]; then
  npm install
fi

echo "🎨 启动前端服务..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 启动完成！"
echo "   后端: http://localhost:3000"
echo "   前端: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止服务"

# 等待进程
wait $BACKEND_PID $FRONTEND_PID
