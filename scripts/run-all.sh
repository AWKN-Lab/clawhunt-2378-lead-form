#!/usr/bin/env bash
# 一键本地复核：依赖安装 -> lint -> 类型检查 -> 组件测试 -> 构建。
# 顺序与 .github/workflows/frontend-ci.yml 的 web 作业一致。
# 用法：bash scripts/run-all.sh（从仓库根目录运行；日志请重定向到 evidence/）。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== node / npm =="
node --version
npm --version

echo "== npm ci =="
npm ci

echo "== lint =="
npm run lint

echo "== typecheck =="
npm run typecheck

echo "== test =="
npx vitest run

echo "== build =="
npm run build

echo "== 全部通过 =="
