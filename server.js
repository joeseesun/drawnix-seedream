const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 启用CORS
app.use(cors());

// 解析JSON请求体
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务 - 服务前端构建产物
app.use(express.static(path.join(__dirname, 'public')));

// 导入API路由
const generateImageHandler = require('./api/generate-image.js');
const generateVideoHandler = require('./api/generate-video.js');
const imageProxyHandler = require('./api/image-proxy.js');
const videoProxyHandler = require('./api/video-proxy.js');

// API路由
app.all('/generate-image', (req, res) => {
  console.log(`🚀 收到${req.method}请求: /generate-image`);
  generateImageHandler(req, res);
});

app.all('/image-proxy', (req, res) => {
  console.log(`🚀 收到${req.method}请求: /image-proxy`);
  imageProxyHandler(req, res);
});

app.all('/video-proxy', (req, res) => {
  console.log(`🚀 收到${req.method}请求: /video-proxy`);
  videoProxyHandler(req, res);
});

app.all('/generate-video', (req, res) => {
  console.log(`🚀 收到${req.method}请求: /generate-video`);
  generateVideoHandler(req, res);
});

app.all('/generate-video/:id', (req, res) => {
  console.log(`🚀 收到${req.method}请求: /generate-video/${req.params.id}`);
  generateVideoHandler(req, res);
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 处理前端路由 - 所有非API请求都返回index.html
app.use((req, res, next) => {
  // 跳过API路由和静态文件
  if (req.path.startsWith('/api/') || req.path.startsWith('/generate-image') || req.path.startsWith('/generate-video') || req.path.startsWith('/image-proxy') || req.path.startsWith('/video-proxy') || req.path.startsWith('/health') || req.path.includes('.')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 检查静态文件目录
const publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) {
  console.warn(`⚠️ 警告: 静态文件目录 ${publicPath} 不存在`);
} else {
  const indexPath = path.join(publicPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.warn(`⚠️ 警告: ${indexPath} 不存在，前端路由可能会失效`);
  }
}

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API服务器已启动`);
  console.log(`🌐 监听地址: 0.0.0.0:${PORT}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/health`);
  console.log(`📂 静态文件目录: ${path.join(__dirname, 'public')}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});
