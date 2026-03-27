#!/bin/bash

set -e

echo "🚀 启动 APK 构建平台..."

# 检查 Node.js 环境
if ! command -v node &> /dev/null; then
  echo "❌ 未检测到 Node.js 环境，开始自动安装..."

  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if command -v brew &> /dev/null; then
      brew install node
    else
      echo "请先安装 Homebrew: https://brew.sh/"
      exit 1
    fi
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    echo "不支持的操作系统，请手动安装 Node.js: https://nodejs.org/"
    exit 1
  fi

  echo "✓ Node.js 安装完成"
fi

echo "✓ Node.js 版本: $(node -v)"

# 后端
echo "📦 安装后端依赖..."
cd backend

# 创建 .env 文件（如果不存在）
if [ ! -f ".env" ]; then
  echo "📝 创建 .env 配置文件..."
  cat > .env << EOF
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-change-in-production"
PORT=3000
EOF
fi

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
