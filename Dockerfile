# 第一阶段：构建前端
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖（使用legacy-peer-deps解决版本冲突）
RUN npm install --legacy-peer-deps

# 复制源代码
COPY . .

# 绕过 NX 直接使用 Vite 构建前端
# Nx 的图谱处理在 Docker 环境中容易报错（如 Failed to process project graph）
RUN npx vite build apps/web --config apps/web/vite.config.mts

# 第二阶段：运行时环境
FROM node:20-alpine AS runtime

WORKDIR /app

# 只安装生产依赖
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# 复制后端API文件
COPY server.js ./
COPY api/ ./api/

# 复制前端构建产物
COPY --from=builder /app/dist/apps/web/ ./public/

# 暴露端口（Zeabur 会自动识别，但 EXPOSE 是一个好习惯）
EXPOSE 3000

# 启动服务
# 使用环境变量 PORT，如果未定义则默认 3000
# 移除 HEALTHCHECK，因为 Zeabur 有自己的健康检查机制，且 Docker 内置健康检查有时会因环境差异导致失败
CMD ["node", "server.js"]
