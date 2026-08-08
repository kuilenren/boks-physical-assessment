-- migrations/0001_core/0001_extensions.sql
-- 依赖：空
-- 说明：启用 PostgreSQL 关键扩展（pgvector / pgcrypto / citext / uuid-ossp）
-- UP
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- boks 专用 schema（业务表统一命名空间）
CREATE SCHEMA IF NOT EXISTS boks;
ALTER SCHEMA boks OWNER TO CURRENT_USER;

-- 默认权限：未来创建的表/序列自动授予 boks_app 读写
ALTER DEFAULT PRIVILEGES IN SCHEMA boks
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO PUBLIC;

-- DOWN
DROP SCHEMA IF EXISTS boks CASCADE;