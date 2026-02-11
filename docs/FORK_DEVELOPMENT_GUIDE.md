# Fork 项目二次开发指南

本文档详细说明了如何在 fork 的 Drawnix 项目上进行二次开发，同时保持与上游项目的同步。

## 🏗️ 项目结构

### 分支策略

- **`develop`**: 跟踪上游项目的 develop 分支，保持与原项目同步
- **`custom-dev`**: 二次开发分支，基于 develop 分支进行自定义功能开发
- **`feature/*`**: 功能分支，从 custom-dev 分支创建，用于开发具体功能

### 远程仓库配置

```bash
# 查看当前远程仓库
git remote -v

# 应该看到：
# origin    https://github.com/WaterDJiang/Wattter-drawnix-seedream (fetch)
# origin    https://github.com/WaterDJiang/Wattter-drawnix-seedream (push)
# upstream  https://github.com/plait-board/drawnix.git (fetch)
# upstream  https://github.com/plait-board/drawnix.git (push)
```

## 🔄 同步上游更新

### 自动同步

项目已配置 GitHub Actions 自动同步工作流（`.github/workflows/sync-upstream.yml`）：

- **自动运行**: 每天凌晨 2 点自动检查并同步上游更新
- **手动触发**: 在 GitHub Actions 页面可以手动触发同步
- **冲突处理**: 如果发生合并冲突，会自动创建 Issue 通知

### 手动同步

如果需要立即同步上游更新：

```bash
# 1. 获取上游最新代码
git fetch upstream

# 2. 切换到 develop 分支并同步
git checkout develop
git merge upstream/develop
git push origin develop

# 3. 将更新合并到 custom-dev 分支
git checkout custom-dev
git merge develop
git push origin custom-dev
```

## 🚀 二次开发工作流

### 1. 创建功能分支

```bash
# 从 custom-dev 创建新功能分支
git checkout custom-dev
git pull origin custom-dev
git checkout -b feature/your-feature-name
```

### 2. 开发功能

```bash
# 进行开发工作
# 编辑代码...

# 提交更改
git add .
git commit -m "feat: 添加新功能描述"
```

### 3. 合并到 custom-dev

```bash
# 推送功能分支
git push origin feature/your-feature-name

# 创建 Pull Request 到 custom-dev 分支
# 或者直接合并（小功能）
git checkout custom-dev
git merge feature/your-feature-name
git push origin custom-dev

# 删除功能分支
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

## 📋 最佳实践

### 1. 分支管理

- ✅ **DO**: 始终从 `custom-dev` 创建功能分支
- ✅ **DO**: 定期将 `develop` 的更新合并到 `custom-dev`
- ❌ **DON'T**: 直接在 `develop` 分支上进行自定义开发
- ❌ **DON'T**: 将自定义代码提交到 `develop` 分支

### 2. 提交规范

使用语义化提交信息：

```bash
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 重构代码
test: 添加测试
chore: 构建过程或辅助工具的变动
```

### 3. 冲突解决

当同步上游更新时发生冲突：

```bash
# 1. 查看冲突文件
git status

# 2. 手动编辑冲突文件，解决冲突标记
# <<<<<<< HEAD
# 你的代码
# =======
# 上游代码
# >>>>>>> upstream/develop

# 3. 标记冲突已解决
git add <冲突文件>

# 4. 完成合并
git commit -m "resolve: 解决上游同步冲突"
```

### 4. 保持代码质量

```bash
# 运行测试
npm test

# 代码格式检查
npm run lint

# 构建检查
npm run build
```

## 🔧 开发环境设置

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run start
```

### 构建项目

```bash
npm run build
```

## 📚 项目特定说明

### Drawnix 架构

- **Nx Monorepo**: 使用 Nx 管理多包项目
- **React + TypeScript**: 主要技术栈
- **Plait 框架**: 底层画图框架
- **插件架构**: 支持扩展功能

### 自定义开发建议

1. **新功能开发**: 优先考虑插件形式实现
2. **UI 定制**: 在 `apps/web/src` 目录下进行
3. **核心逻辑**: 在 `packages/` 目录下扩展
4. **配置修改**: 注意保持与上游的兼容性

## 🚨 注意事项

1. **不要修改 `.github/workflows/ci.yml`**: 这是上游的 CI 配置
2. **保持 package.json 兼容**: 新增依赖时考虑与上游的兼容性
3. **文档同步**: 重要的自定义功能要更新文档
4. **版本管理**: 自定义版本号避免与上游冲突

## 🆘 故障排除

### 同步失败

如果自动同步失败，检查 GitHub Actions 日志：

1. 进入 GitHub 仓库
2. 点击 "Actions" 标签
3. 查看 "Sync Upstream" 工作流的运行日志

### 合并冲突

参考上面的冲突解决步骤，或者：

```bash
# 重置到冲突前状态
git merge --abort

# 使用可视化工具解决冲突
git mergetool
```

### 分支混乱

```bash
# 查看分支状态
git branch -a
git log --oneline --graph

# 重置分支到远程状态
git reset --hard origin/custom-dev
```

---

**记住**: 保持 `develop` 分支纯净，所有自定义开发都在 `custom-dev` 及其功能分支上进行！