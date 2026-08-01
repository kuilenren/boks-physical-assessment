# 基础设施

本目录预留本地和云端基础设施配置：

- PostgreSQL：业务数据、标准元数据和报告；
- Redis：队列、幂等和短期缓存；
- S3 兼容对象存储：私有照片、音频和报告制品；
- OpenTelemetry/Prometheus/Grafana：监控和审计指标。

## 本地依赖

Docker Desktop 启动后，在仓库根目录执行：

```powershell
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps
```

默认提供：

- PostgreSQL：`localhost:5432`，数据库和用户均为 `boks`，密码为 `boks-local-only`；
- Redis：`localhost:6379`。

这些凭据只用于本地开发，不得用于生产环境。停止并删除本地容器（保留数据卷）：

```powershell
docker compose -f infra/docker-compose.yml down
```

开发环境不得写入真实学生数据。正式部署前补充 Terraform、密钥管理、对象存储和备份策略。
