# BOKS Android / iOS App

当前工程已采用 Flutter，先交付 Android 家长端 MVP 闭环：

- 儿童档案；
- 动态体测录入、服务端评分报告；
- 训练计划生成和安全提醒；
- 监护人用途确认、四视角拍摄和质量状态。

体态首版只登记拍摄任务，不生成未经审核的模型风险结论。默认 Android 模拟器 API 地址为 `http://10.0.2.2:3000/v1`，真机或生产构建请通过 `--dart-define=BOKS_API_BASE_URL=...` 设置 HTTPS 地址。

常用命令：

- `flutter analyze`
- `flutter test`
- `flutter build apk --debug --dart-define=BOKS_API_BASE_URL=http://10.0.2.2:3000/v1`

客户端权限、相机、语音和商店要求见：

- [Android/iOS App 开发文档](../../docs/06-mobile-app-development.md)
- [UI 设计文档](../../docs/07-ui-design.md)
- [API 契约](../../docs/09-api-contract.md)

Windows 工作站先完成 Flutter/Android 联调；iOS 签名、真机发布和 App Store 上传在 macOS 构建机完成。
