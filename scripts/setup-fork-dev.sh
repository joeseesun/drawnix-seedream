#!/bin/bash

# Fork 项目二次开发环境快速设置脚本
# 使用方法: bash scripts/setup-fork-dev.sh

set -e

echo "🚀 开始设置 Fork 项目二次开发环境..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 请在项目根目录运行此脚本${NC}"
    exit 1
fi

echo -e "${BLUE}📋 检查当前 Git 配置...${NC}"

# 检查是否已经配置了 upstream
if git remote | grep -q "upstream"; then
    echo -e "${GREEN}✅ upstream 远程仓库已配置${NC}"
else
    echo -e "${YELLOW}⚙️  添加 upstream 远程仓库...${NC}"
    git remote add upstream https://github.com/joeseesun/drawnix-seedream.git
    echo -e "${GREEN}✅ upstream 远程仓库添加成功${NC}"
fi

# 获取上游最新代码
echo -e "${BLUE}📥 获取上游最新代码...${NC}"
git fetch upstream

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}📍 当前分支: ${CURRENT_BRANCH}${NC}"

# 确保 develop 分支存在并同步
if git branch | grep -q "develop"; then
    echo -e "${BLUE}🔄 同步 develop 分支...${NC}"
    git checkout develop
    git merge upstream/develop --no-edit
    git push origin develop
else
    echo -e "${YELLOW}⚙️  创建 develop 分支...${NC}"
    git checkout -b develop upstream/develop
    git push -u origin develop
fi

# 检查并创建 custom-dev 分支
if git branch | grep -q "custom-dev"; then
    echo -e "${GREEN}✅ custom-dev 分支已存在${NC}"
    git checkout custom-dev
    echo -e "${BLUE}🔄 更新 custom-dev 分支...${NC}"
    git merge develop --no-edit
    git push origin custom-dev
else
    echo -e "${YELLOW}⚙️  创建 custom-dev 分支...${NC}"
    git checkout -b custom-dev develop
    git push -u origin custom-dev
fi

# 安装依赖
echo -e "${BLUE}📦 安装项目依赖...${NC}"
npm install

# 运行测试确保环境正常
echo -e "${BLUE}🧪 运行测试验证环境...${NC}"
if npm test; then
    echo -e "${GREEN}✅ 测试通过，环境配置成功${NC}"
else
    echo -e "${YELLOW}⚠️  测试失败，但环境基本配置完成${NC}"
fi

# 显示当前状态
echo -e "${BLUE}📊 当前 Git 状态:${NC}"
git remote -v
echo ""
git branch -a

echo -e "${GREEN}🎉 Fork 项目二次开发环境设置完成！${NC}"
echo ""
echo -e "${BLUE}📚 接下来你可以:${NC}"
echo -e "  1. 阅读 ${YELLOW}FORK_DEVELOPMENT_GUIDE.md${NC} 了解详细开发流程"
echo -e "  2. 运行 ${YELLOW}npm run start${NC} 启动开发服务器"
echo -e "  3. 从 ${YELLOW}custom-dev${NC} 分支创建功能分支开始开发"
echo ""
echo -e "${BLUE}🔧 常用命令:${NC}"
echo -e "  • 创建功能分支: ${YELLOW}git checkout -b feature/your-feature${NC}"
echo -e "  • 同步上游更新: ${YELLOW}git fetch upstream && git checkout develop && git merge upstream/develop${NC}"
echo -e "  • 启动开发服务器: ${YELLOW}npm run start${NC}"
echo -e "  • 运行测试: ${YELLOW}npm test${NC}"
echo -e "  • 构建项目: ${YELLOW}npm run build${NC}"