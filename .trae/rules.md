# Fork 项目管理规则

本文档记录了 Fork 项目的上游同步和开发分支合并的标准操作规则，确保每次操作都能安全、正确地执行。

## 📋 目录

- [分支策略](#分支策略)
- [上游源更新流程](#上游源更新流程)
- [开发分支合并步骤](#开发分支合并步骤)
- [GitHub 提交前检查清单](#github-提交前检查清单)
- [常见错误预防措施](#常见错误预防措施)
- [冲突解决指南](#冲突解决指南)
- [最佳实践](#最佳实践)

## 🌳 分支策略

### 分支说明
- **main**: 跟踪上游 main 分支，保持与原项目同步
- **develop**: 跟踪上游 develop 分支（如果存在）
- **custom-dev**: 你的二次开发分支，基于最新的上游代码进行定制
- **feature/***: 功能开发分支，从 custom-dev 分出
- **hotfix/***: 紧急修复分支

### 远程仓库配置
```bash
# upstream: 原项目仓库
# origin: 你的 Fork 仓库
git remote -v
```

## 🔄 上游源更新流程

### 1. 检查当前状态
```bash
# 确保工作区干净
git status

# 查看当前分支
git branch -a

# 检查远程仓库配置
git remote -v
```

### 2. 获取上游更新
```bash
# 获取上游所有分支的最新更新
git fetch upstream

# 查看上游更新情况
git log --oneline --graph upstream/main ^main
```

### 3. 更新本地 main 分支
```bash
# 切换到 main 分支
git checkout main

# 合并上游更新（快进合并）
git merge upstream/main

# 推送到你的 Fork 仓库
git push origin main
```

### 4. 更新 develop 分支（如果存在）
```bash
# 切换到 develop 分支
git checkout develop

# 合并上游更新
git merge upstream/develop

# 推送到你的 Fork 仓库
git push origin develop
```

## 🔀 开发分支合并步骤

### 1. 准备工作
```bash
# 确保 custom-dev 分支是最新的
git checkout custom-dev
git status

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  有未提交的更改，请先处理"
    git status
    exit 1
fi
```

### 2. 合并上游更新到开发分支
```bash
# 方法1: 使用 merge（保留完整历史）
git merge main

# 方法2: 使用 rebase（线性历史，推荐用于功能分支）
# git rebase main
```

### 3. 处理冲突（如果有）
```bash
# 查看冲突文件
git status

# 手动解决冲突后
git add .
git commit -m "resolve merge conflicts with upstream updates"
```

### 4. 测试验证
```bash
# 安装依赖
npm install

# 运行测试
npm test

# 构建项目
npm run build

# 启动开发服务器验证
npm start
```

## ✅ GitHub 提交前检查清单

### 代码质量检查
- [ ] 代码已通过 ESLint 检查
- [ ] 代码已通过 Prettier 格式化
- [ ] 所有测试用例通过
- [ ] 构建成功无错误
- [ ] 没有 console.log 等调试代码

### Git 操作检查
- [ ] 当前分支正确（custom-dev 或 feature/*）
- [ ] 提交信息清晰明确
- [ ] 没有提交敏感信息（API 密钥、密码等）
- [ ] 文件权限正确
- [ ] .gitignore 文件已更新（如需要）

### 分支状态检查
```bash
# 检查当前分支
git branch --show-current

# 检查与上游的差异
git log --oneline main..HEAD

# 检查文件状态
git status --porcelain
```

### 推送前最后检查
```bash
# 确认推送目标
echo "当前分支: $(git branch --show-current)"
echo "推送目标: origin/$(git branch --show-current)"

# 预览将要推送的提交
git log --oneline origin/$(git branch --show-current)..HEAD
```

## 🚨 常见错误预防措施

### 1. 避免直接在 main 分支开发
```bash
# 设置 pre-commit hook 检查
if [ "$(git branch --show-current)" = "main" ]; then
    echo "❌ 不允许直接在 main 分支提交代码"
    exit 1
fi
```

### 2. 防止推送到错误的远程仓库
```bash
# 检查远程仓库 URL
git remote get-url origin
git remote get-url upstream

# 确保 origin 是你的 Fork，upstream 是原项目
```

### 3. 避免强制推送到共享分支
```bash
# 永远不要对以下分支使用 git push --force
# - main
# - develop
# - custom-dev（如果有其他人在使用）
```

### 4. 提交前检查文件大小
```bash
# 检查大文件
find . -type f -size +10M -not -path "./node_modules/*" -not -path "./.git/*"

# 检查二进制文件
find . -type f -exec file {} \; | grep -v text | grep -v directory
```

## 🔧 冲突解决指南

### 1. 识别冲突类型
```bash
# 查看冲突文件
git status

# 查看冲突详情
git diff
```

### 2. 解决策略

#### 内容冲突
- 手动编辑文件，保留需要的更改
- 删除冲突标记（`<<<<<<<`, `=======`, `>>>>>>>`）
- 测试合并后的代码

#### 文件重命名冲突
```bash
# 查看重命名冲突
git status

# 选择保留的文件名
git add <chosen-filename>
git rm <unwanted-filename>
```

#### 依赖冲突
```bash
# package.json 冲突
# 1. 手动合并依赖
# 2. 重新安装
npm install

# 检查 package-lock.json
git add package-lock.json
```

### 3. 冲突解决后的验证
```bash
# 确保没有遗留的冲突标记
grep -r "<<<<<<< \|======= \|>>>>>>> " . --exclude-dir=node_modules --exclude-dir=.git

# 运行测试
npm test

# 提交解决方案
git add .
git commit -m "resolve conflicts: [简要描述冲突类型和解决方案]"
```

## 🎯 最佳实践

### 1. 定期同步
- 每周至少同步一次上游更新
- 重大功能开发前先同步
- 发现上游有重要更新时及时同步

### 2. 提交规范
```bash
# 使用语义化提交信息
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建工具、辅助工具等

# 示例
git commit -m "feat: add custom drawing tools for enhanced user experience"
git commit -m "fix: resolve canvas rendering issue on mobile devices"
```

### 3. 分支管理
```bash
# 功能开发流程
git checkout custom-dev
git pull origin custom-dev
git checkout -b feature/new-drawing-tool
# ... 开发 ...
git push origin feature/new-drawing-tool
# 创建 PR 到 custom-dev
```

### 4. 备份重要工作
```bash
# 重要更改前创建备份分支
git checkout -b backup/before-major-merge
git push origin backup/before-major-merge
```

### 5. 使用脚本自动化
```bash
# 使用项目中的脚本
./scripts/setup-fork-dev.sh  # 初始设置
./scripts/sync-upstream.sh   # 同步上游
```

## 📞 紧急情况处理

### 1. 错误推送到 main 分支
```bash
# 如果还没有其他人拉取
git push origin main --force-with-lease

# 如果已经有人拉取，创建修复提交
git revert <commit-hash>
git push origin main
```

### 2. 推送到错误的远程仓库
```bash
# 立即联系仓库管理员
# 如果推送到了 upstream，请求删除相关分支
```

### 3. 丢失重要更改
```bash
# 使用 reflog 恢复
git reflog
git checkout <commit-hash>
git checkout -b recovery-branch
```

---

## 📝 操作记录模板

每次重要操作后，建议记录：

```
日期: YYYY-MM-DD
操作: 上游同步/分支合并/功能开发
分支: main -> custom-dev
冲突: 是/否
测试: 通过/失败
备注: [具体说明]
```

---

**记住**: 当不确定操作是否安全时，先创建备份分支！

**联系方式**: 如遇到无法解决的问题，请及时寻求帮助。