# 开发协作约定

## 本地准备

```powershell
corepack enable
pnpm install
python -m venv services/ai/.venv
.\services\ai\.venv\Scripts\python.exe -m pip install -e "services/ai[dev]"
```

详细环境要求见：

- [技术架构](docs/04-technical-architecture.md)
- [小程序开发](docs/05-miniprogram-development.md)
- [Android/iOS App 开发](docs/06-mobile-app-development.md)
- [测试、发布与运营](docs/12-test-release-operations.md)

## 检查

```powershell
pnpm check
.\services\ai\.venv\Scripts\ruff.exe check services\ai
.\services\ai\.venv\Scripts\pytest.exe services\ai\tests
```

## 自动推送

仓库启用 `.githooks/post-commit` 后，每次本地完成 `git commit` 会自动推送当前分支到 GitHub。钩子不会自动创建提交，不会替开发者把未审阅的工作区改动直接提交。

推送失败时，提交仍保留在本地，可使用：

```powershell
.\scripts\push.ps1
```

不要把真实密钥、儿童照片、音频、报告或未脱敏数据提交到仓库。
