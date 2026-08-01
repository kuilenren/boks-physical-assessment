# 06 Android / iOS App 开发文档

## 1. 工程方案

- 框架：Flutter。
- 状态管理：Riverpod 或团队统一方案。
- 路由：声明式路由，路由守卫检查登录、监护人授权和数据范围。
- 网络：Dio + OpenAPI 生成类型模型；统一超时、重试和错误码。
- 本地数据：加密 SQLite/secure storage；不落盘原始体态照片。
- 推理：优先端侧 ONNX/Core ML/TFLite；服务端模型是同一版本协议的后备路径。
- 原生能力：Android CameraX、Photo Picker、MediaRecorder；iOS AVFoundation、Photos、Speech framework 或服务端 ASR。

## 2. Flutter 目录

```text
lib/
  app/
    router.dart
    theme.dart
    environment.dart
  features/
    auth/
    family/
    assessment/
    posture/
    report/
    training/
    consultation/
    privacy/
  shared/
    api/
    models/
    widgets/
    security/
    analytics/
  native/
    camera_bridge.dart
    pose_bridge.dart
    speech_bridge.dart
```

原生实现放在 `android/`、`ios/` 或独立插件仓库，业务层只依赖类型化接口，不直接操作平台对象。

## 3. App 状态机

```text
installed -> onboarding -> privacy_pending -> authenticated
authenticated -> family_ready -> assessment/posture/training
authenticated -> privacy_withdrawn -> limited_mode
```

- `limited_mode` 允许查看公开内容和删除/导出设置，不允许新采集敏感数据。
- App 切后台时暂停摄像头和录音，任务状态写入本地。
- 登录过期时清理 token，但不立即删除用户草稿，等待用户重新认证。

## 4. Android 开发要求

### 4.1 权限

- 摄像头：仅在用户进入拍摄并确认后申请。
- 相册：优先使用 Android Photo Picker，避免读取整个媒体库。
- 麦克风：仅录音时申请。
- 通知：用于训练提醒时说明用途，拒绝后不影响核心功能。
- 不申请电话、通讯录、精确位置等无关权限。

权限拒绝后显示可执行的设置入口和手工替代方案，不循环弹窗。

### 4.2 相机与姿态

- CameraX 固定预览方向和视场角；
- 拍摄时覆盖安全框、脚位线和距离提示；
- 记录设备型号、相机方向和应用版本，不记录不必要的设备标识；
- 端侧推理失败才上传到服务端，且需用户已授权；
- 原生推理插件返回关键点坐标、置信度、模型版本和耗时，不返回未经处理的个人识别特征。

### 4.3 发布

- 声明数据安全和儿童数据用途；
- 清单中配置最小权限；
- 提供隐私政策、删除账号/儿童数据入口；
- 使用 Play App Signing；
- 生产构建关闭调试日志和测试 API；
- 进行不同 Android 版本、屏幕、相机和弱网验收。

## 5. iOS 开发要求

### 5.1 权限与配置

`Info.plist` 至少配置：

- `NSCameraUsageDescription`：说明拍摄儿童姿态照片的目的；
- `NSPhotoLibraryUsageDescription`：说明选择已有照片的目的；
- `NSMicrophoneUsageDescription`：说明语音咨询的目的；
- 如使用语音识别，再配置对应用途说明。

权限申请必须由用户动作触发；拒绝后提供设置入口和文本替代。

### 5.2 相机和系统能力

- 使用 AVFoundation 控制固定相机方向和曝光；
- 使用 Vision/Core ML 时记录模型版本和设备端推理状态；
- 进入后台立即停止相机、麦克风和临时视频写入；
- 使用 Photos 选择器而不是全量读取相册；
- App 隐私清单如实声明照片、健康/健身、用户内容和诊断信息的处理方式。

### 5.3 App Store

- 如实填写 App Privacy Details；
- 若进入儿童类别，不使用第三方广告、跨 App 跟踪或不必要的分析 SDK；
- 页面不能宣传“诊断、治疗、替代医生”；
- 提供监护人控制、删除和联系渠道；
- 审核备注说明体态结果是非诊断性观察。

## 6. 语音、多模态和隐私

- ASR/TTS 统一走 `speech_service`，App 只持有短期任务 ID。
- 音频不在后台持续监听；不提供唤醒词。
- 用户选择的报告/照片才加入咨询上下文。
- 多模态请求发送 `consent_scope` 和 `asset_ids`，服务端再次校验。
- App 日志不记录音频、图片和完整聊天文本。

## 7. 离线能力

允许离线：

- 查看已缓存的训练动作说明；
- 编辑未提交体测草稿；
- 记录训练完成状态，联网后同步。

不允许离线完成：

- 新的敏感照片分析；
- 规则评分；
- 医疗风险或家长就医提示结论；
- 知识库发布。

同步采用版本号和幂等键；冲突时保留双方记录并提示用户选择，不静默覆盖。

## 8. 安全存储

- Token 存 Keychain/Keystore；
- 本地数据库使用平台安全存储的密钥；
- 临时图片在任务完成、取消或超时后删除；
- App 卸载后服务端数据仍按账户保留策略处理；
- 截屏策略：报告默认允许用户主动分享，但后台审核页和敏感原图页可按平台能力禁止截屏/录屏。

## 9. App 测试矩阵

| 维度 | 覆盖 |
| --- | --- |
| Android | 主流 Android 版本、低内存、不同屏幕和相机 |
| iOS | 当前支持版本、刘海/动态岛、旧设备性能 |
| 权限 | 首次、拒绝、再次授权、系统设置恢复 |
| 网络 | 2G/弱网、断网、切换 Wi-Fi/蜂窝 |
| 生命周期 | 冷启动、切后台、被系统杀进程、来电中断 |
| 数据 | 多儿童、删除、撤回、登录过期、冲突同步 |
| 模型 | 端侧可用、端侧失败、服务端超时、版本升级 |

## 10. 发布清单

- [ ] Android Data Safety、儿童数据和删除流程完成。
- [ ] iOS App Privacy Details、权限文案和儿童类别策略完成。
- [ ] 生产环境 URL、证书、签名和崩溃上报配置完成。
- [ ] 端侧模型与服务端模型的版本兼容矩阵完成。
- [ ] 取消上传、删除照片和撤回授权在两端均可验证。
- [ ] 商店截图和描述无诊断性、治疗性或夸大准确率文案。
