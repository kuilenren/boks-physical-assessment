# 基础设施

本目录预留本地和云端基础设施配置：

- PostgreSQL：业务数据、标准元数据和报告；
- Redis：队列、幂等和短期缓存；
- S3 兼容对象存储：私有照片、音频和报告制品；
- OpenTelemetry/Prometheus/Grafana：监控和审计指标。

开发环境不得写入真实学生数据。正式部署前补充 Terraform、Docker Compose、密钥管理和备份策略。
