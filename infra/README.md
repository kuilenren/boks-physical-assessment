# 基础设施

正式生产部署（腾讯云广州 `152.136.218.37`）所需的所有配置都在本目录。

## 目录结构

```
infra/
├── deploy/
│   └── deploy.sh              # 一键部署脚本（在生产服务器执行）
├── docker-compose.yml         # 依赖（postgres / redis / minio）生产覆盖
├── hot-update/                # 微信小程序热更新制品目录
│   └── manifest.json
└── nginx/
    └── boks-ai.com.cn.conf    # 四个子域名的反向代理 + TLS 终止
```

## 域名规划

| 域名                          | 用途                          | 后端                |
|------------------------------|------------------------------|--------------------|
| `api.boks-ai.com.cn`         | REST API + SSE 流式响应        | `127.0.0.1:3000`   |
| `www.boks-ai.com.cn`         | Web 静态站（暂 302 → api）     | `127.0.0.1:3000`   |
| `ai.boks-ai.com.cn`          | Python AI 服务（FastAPI）      | `127.0.0.1:8001`   |
| `boks-ai.com.cn`（裸域）      | 默认跳到 `www`                  | —                  |

四个域名共用同一份 TLS 证书（`fullchain.pem` + `privkey.pem`）。

## 本地依赖（开发）

仓库根目录的 `docker-compose.yml` 启动 PostgreSQL / Redis / MinIO。
本地访问：

- PostgreSQL：`localhost:5433`（容器内 5432）
- Redis：`localhost:6379`

凭据仅用于开发，不得用于生产。

## 生产部署流程

详见 `infra/deploy/deploy.sh`。在生产服务器（root 或具备 docker 权限的用户）执行：

```bash
sudo bash infra/deploy/deploy.sh /opt/boks
```

脚本会：

1. 拉取最新 `main` 分支；
2. 校验 `.env` 已存在（基于 `.env.production.example`）；
3. `docker compose up -d --build`；
4. 等待 API/AI 健康检查通过；
5. 运行迁移（`@boks/api migrate:up`）；
6. 部署 nginx 站点 + 热更新静态文件；
7. 提醒首次部署需要 `certbot` 申请证书。

部署完成后 **必须** 引导 KMS / DEK：

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec api \
  pnpm exec tsx scripts/bootstrap-kms.ts
```

该脚本会为 `boks.boks_families` 中每一个 family 生成一个 DEK（用当前 KEK 包装后写入 `boks.boks_kms_keys`），并校验 `BOKS_KEK_BASE64` 必须是 32 字节（base64 解码后）。

支持 `--rotate --new-kek-id=kek-v2` 进行 KEK 轮换。

## 监控与备份（待补）

- Prometheus + Grafana + Loki（建议）
- 腾讯云 CBS 每日快照
- KMS 密钥自动轮换策略（季度）