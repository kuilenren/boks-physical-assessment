# 05 微信小程序开发文档

## 1. 工程基线

- 框架：Taro 4 + React + TypeScript。
- 包管理：pnpm。
- 状态：Zustand 或项目统一状态库；敏感数据只在需要的页面生命周期内保留。
- 路由：Taro 页面路由，所有深链先校验监护人会话和授权。
- 网络：统一 `request` 封装，处理 token、trace_id、错误码和重试。
- 上传：服务端预签名 URL；小程序不持有对象存储长期密钥。
- 视觉：按照 [07-ui-design.md](07-ui-design.md) 的 token 和组件命名。

## 2. 建议目录

```text
src/
  app.config.ts
  app.ts
  pages/
    home/
    family/
    assessment/
    posture/
    report/
    training/
    consultation/
    privacy/
  components/
    privacy/
    child-selector/
    metric-input/
    quality-feedback/
    report-card/
    training-card/
  services/
    auth.ts
    assessment.ts
    posture.ts
    report.ts
    training.ts
    consultation.ts
    upload.ts
  stores/
    session.ts
    family.ts
    draft.ts
  utils/
    validation.ts
    permissions.ts
    telemetry.ts
  styles/
    tokens.scss
    mixins.scss
```

## 3. 页面和路由

| 路由 | 页面 |
| --- | --- |
| `/pages/home/index` | 首页、儿童切换、快捷入口 |
| `/pages/family/index` | 儿童档案和监护人设置 |
| `/pages/assessment/start` | 选择学段、标准和测量日期 |
| `/pages/assessment/input` | 体测录入 |
| `/pages/assessment/review` | 提交前复核 |
| `/pages/posture/consent` | 体态用途、适用范围、授权 |
| `/pages/posture/capture` | 四视角拍摄 |
| `/pages/posture/progress` | 分析进度 |
| `/pages/report/list` | 报告列表 |
| `/pages/report/detail` | 报告详情 |
| `/pages/training/detail` | 周计划、动作和打卡 |
| `/pages/consultation/index` | 文本、语音和图片上下文咨询 |
| `/pages/privacy/index` | 隐私、授权、导出、删除 |

TabBar 建议只保留“首页、体测、体态、训练、我的”五项，咨询作为页面内入口，避免儿童用户迷路。

## 4. 小程序隐私授权

微信官方指南要求在小程序管理后台配置《小程序用户隐私保护指引》，并在用户同意后调用已声明的隐私接口。开发实现需覆盖：

1. 启动时调用 `wx.getPrivacySetting` 查询状态；
2. 需要授权时显示简明说明和 `open-type="agreePrivacyAuthorization"` 按钮；
3. 用户同意回调后才能调用相册、摄像头、麦克风等接口；
4. 用户拒绝时保留手工体测功能，不能反复强弹；
5. 隐私说明必须列出照片/音频用途、上传、留存、删除和模型训练策略。

示意逻辑（伪代码）：

```ts
async function ensurePrivacyAuthorization(): Promise<boolean> {
  const setting = await wx.getPrivacySetting()
  if (!setting.needAuthorization) return true

  // 页面展示隐私说明；用户点击官方同意按钮后再继续
  return waitForAgreePrivacyAuthorization()
}

async function startPostureCapture() {
  if (!(await ensurePrivacyAuthorization())) {
    throw new AppError('PRIVACY_NOT_AUTHORIZED')
  }
  return wx.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sourceType: ['camera']
  })
}
```

上面的代码是流程示意，实际项目要按当前微信基础库和官方接口签名实现，并覆盖低版本兼容。

## 5. 拍照与上传

### 5.1 设备端预检查

- 最小分辨率和文件大小；
- 照片方向和 EXIF 旋转；
- 人体完整性、多人、遮挡和背景；
- 仅保存必要的 `view_type` 和任务 ID；
- 失败时不上传原图。

### 5.2 上传流程

```text
POST /v1/media/upload-sessions
  -> upload_session_id + signed_url + object_key + expires_at
  -> wx.uploadFile / 分片（按平台能力）
  -> POST /v1/media/upload-sessions/{id}/complete
  -> 服务端校验 MIME、大小、哈希和授权
  -> 创建 posture_quality_check job
```

客户端不得把签名 URL 写入埋点或错误日志。

### 5.3 失败处理

| 错误 | 用户提示 | 动作 |
| --- | --- | --- |
| `PHOTO_TOO_LARGE` | 图片太大，请重拍 | 不重试同一文件 |
| `PHOTO_QUALITY_LOW` | 光线/距离/遮挡不合适 | 显示具体建议 |
| `UPLOAD_EXPIRED` | 上传已过期，请重试 | 获取新签名 |
| `PRIVACY_NOT_AUTHORIZED` | 需要监护人同意 | 打开隐私说明 |
| `ANALYSIS_UNAVAILABLE` | 分析暂不可用 | 保留任务，稍后重试 |

## 6. 体测录入实现

- 从 API 获取 `assessment_schema`，动态渲染指标。
- 每个输入绑定 `indicator_code`，同时保存单位。
- 使用 decimal/字符串保存输入，避免 JS 浮点误差。
- 草稿存储在页面状态和加密本地缓存；退出家庭/删除儿童时清理。
- 提交时发送 `idempotency_key`，防止重复点击。
- 结果页只相信服务端 `report_id` 和 `score_trace`。

## 7. 音频和咨询

- 只有用户点击录音时申请麦克风权限；
- 录音达到时长/大小上限时自动停止并明确提示；
- 音频上传使用短期签名 URL，ASR 完成后按保留策略删除；
- 转写结果先显示编辑确认，再发送给 AI；
- TTS 播报时显示可读文字和停止按钮；
- AI 结果渲染引用、风险提示和“联系专业人员”按钮。

## 8. 网络和缓存

- 所有请求附带 `X-Client-Version`、`X-Platform`、`X-Trace-Id`。
- 仅缓存非敏感字典、动作缩略图和已授权的报告摘要。
- 体态原图不进入本地持久缓存；页面离开后释放临时文件。
- 弱网下体测草稿可离线保存，评分和报告必须联网完成。
- 服务器返回 `409` 时重新拉取儿童档案/版本，不覆盖用户输入。

## 9. 性能和体验

- 首页首屏不加载 AI SDK、报告大图和咨询历史。
- 图片上传前压缩到服务端建议尺寸，保留原图策略由服务端决定。
- 长列表使用分页和虚拟列表。
- 分析进度使用轮询退避或 WebSocket 替代高频轮询。
- 报告分享图异步生成，先显示结构化报告。
- 崩溃日志只包含页面、错误码、版本和 trace_id。

## 10. 兼容与审核

- 在微信开发者工具和至少两类真实 Android/iOS 设备验证；
- 覆盖基础库低版本、拒绝隐私授权、拒绝相机/相册、弱网和中断恢复；
- 在小程序后台完成服务内容声明、隐私指引、类目和备案；
- 不在小程序描述、页面或分享图使用诊断/治疗/替代医生等宣传；
- 上线前由法务审阅隐私文本、用户协议和儿童说明。

## 11. 小程序验收

- [ ] 同意隐私前摄像头、相册、麦克风接口不可用。
- [ ] 拒绝授权后仍能使用不需要敏感数据的体测功能。
- [ ] 上传 URL 过期、重复提交和断网均可恢复。
- [ ] 服务端规则版本与客户端展示一致。
- [ ] 原图不会出现在日志、分享卡片和 BOKS 内部非必要页面。
- [ ] 删除儿童档案后小程序缓存和本地草稿清理。
