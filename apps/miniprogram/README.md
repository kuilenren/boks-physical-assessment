# 微信小程序

当前工程已采用 Taro 4 + React + TypeScript，先交付 BOKS 家长端 MVP 闭环：

- 首页和儿童档案；
- 动态体测项目、草稿提交、服务端评分报告；
- 训练计划生成和安全边界；
- 体态用途授权、四视角拍摄任务和质量门禁状态。

姿态首版只做授权、拍摄引导和任务完整性检查，不生成未经审核的模型风险结论。

具体页面、隐私授权、上传和发布约定见：

- [小程序开发文档](../../docs/05-miniprogram-development.md)
- [UI 设计文档](../../docs/07-ui-design.md)
- [API 契约](../../docs/09-api-contract.md)

- 开发命令：`pnpm --filter @boks/miniprogram dev:weapp`
- 构建命令：`pnpm --filter @boks/miniprogram build:weapp`
- 真实 AppID、类目、隐私指引和生产 API 域名必须在上线前替换，开发 API 默认使用 `http://127.0.0.1:3000/v1`。
