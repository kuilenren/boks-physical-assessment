#!/usr/bin/env bash
# 推送 BOKS 工业级升级到 GitHub（恢复网络后手动执行）
# 用法：
#   1. 在 https://github.com/settings/tokens 创建 PAT（勾选 repo）
#   2. export GH_TOKEN=ghp_xxxxxxxx
#   3. bash scripts/push-to-github.sh
#
# 本地已有 3 个 commits 待推送：
#   947a48d  feat: industrial-grade upgrade — P0 round 1
#   9ba9065  docs: add industrial upgrade report (P0 round 1)
#   3e01f8a  docs: link 14-23 in README index
set -euo pipefail

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "❌ GH_TOKEN 未设置"
  echo "   export GH_TOKEN=ghp_xxxxxxxx"
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Pushing $BRANCH to origin..."

git push "https://x-access-token:${GH_TOKEN}@github.com/kuilenren/boks-physical-assessment.git" "$BRANCH"

echo "✅ Pushed successfully"
echo ""
echo "查看：https://github.com/kuilenren/boks-physical-assessment"