-- migrations/0001_core/0003_app_user.sql
-- 依赖：0001_extensions
-- 说明：分层应用账户（owner 迁移 / app 运行时 / readonly 审计）
-- UP
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'boks_app') THEN
    CREATE ROLE boks_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'boks_owner') THEN
    CREATE ROLE boks_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'boks_readonly') THEN
    CREATE ROLE boks_readonly NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA boks TO boks_app, boks_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA boks TO boks_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA boks
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO boks_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA boks
  GRANT USAGE, SELECT ON SEQUENCES TO boks_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA boks
  GRANT SELECT ON TABLES TO boks_readonly;

-- DOWN
REVOKE ALL ON SCHEMA boks FROM boks_readonly, boks_app;
DROP ROLE IF EXISTS boks_readonly;
DROP ROLE IF EXISTS boks_app;
-- boks_owner 保留（迁移用），不在此处删除