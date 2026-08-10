#!/usr/bin/env bash
# ============================================================
# BOKS 生产部署脚本（腾讯云广州 152.136.218.37 / Ubuntu）
# 在服务器上以 root 或具备 docker 权限的用户执行。
# 前置：git clone 仓库、安装 docker + docker compose + nginx + certbot
# ============================================================
set -euo pipefail

REPO_DIR="${1:-/opt/boks}"
cd "$REPO_DIR"

echo "==> 1/6 拉取最新代码"
git fetch --all --prune
git checkout main
git pull --ff-only origin main

echo "==> 2/6 准备生产环境变量"
if [ ! -f .env ]; then
  echo "!! 缺少 .env，请复制 .env.production.example 并填写真实密钥！"
  echo "   cp .env.production.example .env && vi .env"
  exit 1
fi

echo "==> 3/6 构建并启动容器"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

echo "==> 4/6 等待健康检查"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/v1/health >/dev/null 2>&1; then
    echo "    API 健康 ✓"
    break
  fi
  [ "$i" -eq 30 ] && { echo "!! API 未在 30 秒内就绪" ; exit 1; }
  sleep 2
done
if curl -fsS http://127.0.0.1:8001/health >/dev/null 2>&1; then
  echo "    AI 健康 ✓"
fi

echo "==> 5/6 数据库迁移"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api pnpm --filter @boks/api migrate:up

echo "==> 6/6 Nginx 配置 + 热更新静态文件"
sudo mkdir -p /var/www/boks-ai.com.cn/updates
sudo cp -r infra/hot-update/*.json /var/www/boks-ai.com.cn/updates/
sudo cp -r infra/hot-update/*.zip /var/www/boks-ai.com.cn/updates/ 2>/dev/null || true
sudo cp infra/nginx/boks-ai.com.cn.conf /etc/nginx/sites-available/boks-ai.com.cn.conf
sudo ln -sf /etc/nginx/sites-available/boks-ai.com.cn.conf /etc/nginx/sites-enabled/boks-ai.com.cn.conf
sudo nginx -t && sudo systemctl reload nginx
echo "    Nginx 重载 ✓"

echo ""
echo "部署完成！"
echo "  API:  https://api.boks-ai.com.cn/v1"
echo "  Web:  https://www.boks-ai.com.cn"
echo "  AI:   https://ai.boks-ai.com.cn"
echo ""
echo "首次部署记得申请 TLS 证书（一次性）："
echo "  sudo certbot --nginx \\"
echo "    -d api.boks-ai.com.cn \\"
echo "    -d www.boks-ai.com.cn \\"
echo "    -d ai.boks-ai.com.cn \\"
echo "    -d boks-ai.com.cn"
echo ""
echo "生产 KEK 已就位后还需要引导所有 family 的 DEK："
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api \\"
echo "    pnpm exec tsx scripts/bootstrap-kms.ts"
