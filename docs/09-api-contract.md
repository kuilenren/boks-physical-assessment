# 09 API 契约文档

## 1. 基础约定

- Base URL：`https://api.example.com/v1`
- JSON：`application/json; charset=utf-8`
- 时间：RFC 3339 UTC，例如 `2026-08-01T01:30:00Z`
- ID：UUIDv7 字符串
- 分页：`page_token`，服务端返回 `next_page_token`
- 幂等：创建/提交接口要求 `Idempotency-Key`
- 请求头：

```text
Authorization: Bearer <access_token>
X-Client-Platform: wechat-mini-program|android|ios|admin-web
X-Client-Version: 1.0.0
X-Trace-Id: <uuid>
Idempotency-Key: <uuid>       # 写接口
```

## 2. 统一响应和错误

成功：

```json
{
  "data": {},
  "meta": {
    "trace_id": "0190...",
    "request_id": "0190..."
  }
}
```

失败：

```json
{
  "error": {
    "code": "PHOTO_QUALITY_LOW",
    "message": "照片质量不满足分析要求",
    "details": [
      {"field": "view_type", "reason": "subject_occluded"}
    ],
    "retryable": false
  },
  "meta": {"trace_id": "0190..."}
}
```

客户端根据 `code` 分支，不根据中文 `message` 判断逻辑。

## 3. 身份和隐私

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/auth/wechat/exchange` | 微信登录凭证换取会话 |
| `POST` | `/auth/app/login` | App 登录 |
| `POST` | `/auth/refresh` | 刷新会话 |
| `POST` | `/auth/logout` | 撤销当前设备 |
| `GET` | `/me` | 当前监护人摘要 |
| `GET` | `/privacy/consents` | 授权记录 |
| `POST` | `/privacy/consents` | 创建/更新单项授权 |
| `POST` | `/privacy/withdrawals` | 撤回授权 |
| `POST` | `/privacy/erasure-requests` | 创建数据删除请求 |
| `GET` | `/privacy/export-requests/{id}` | 查询导出状态 |

创建照片/音频任务前，服务端必须检查 `consent_type=photo/audio` 的有效记录。

## 4. 家庭和儿童

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/families/me` | 家庭摘要 |
| `GET` | `/families/me/children` | 儿童列表 |
| `POST` | `/families/me/children` | 创建儿童 |
| `PATCH` | `/children/{child_id}` | 编辑非历史字段 |
| `GET` | `/children/{child_id}` | 查看儿童 |
| `GET` | `/children/{child_id}/permissions` | 可用数据范围 |

创建儿童示例：

```json
{
  "display_name": "小朋友",
  "birth_date": "2018-04-12",
  "sex_code": "female",
  "school_stage": "primary",
  "grade_code": "grade_2"
}
```

服务端返回时隐藏出生日期明文，仅在监护人授权页面按需展示。

## 5. 体测 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/assessment/schemas?child_id=&measurement_date=` | 获取项目和输入规则 |
| `POST` | `/assessment/sessions` | 创建草稿 |
| `PATCH` | `/assessment/sessions/{id}` | 保存草稿 |
| `POST` | `/assessment/sessions/{id}/submit` | 提交并评分 |
| `GET` | `/assessment/sessions/{id}` | 查询状态和输入 |
| `GET` | `/assessment/sessions/{id}/trace` | 查询计算轨迹 |
| `GET` | `/children/{child_id}/assessment-trends` | 查询趋势 |

提交示例：

```json
{
  "measurement_date": "2026-07-31",
  "standard_version_id": "0190...",
  "test_status": "completed",
  "values": [
    {"indicator_code": "height", "raw_value": "128.4", "unit": "cm"},
    {"indicator_code": "weight", "raw_value": "26.0", "unit": "kg"},
    {"indicator_code": "run_50m", "raw_value": "10.4", "unit": "s"},
    {"indicator_code": "rope_1min", "raw_value": "92", "unit": "count"}
  ]
}
```

服务端不得接受客户端提交的 `score`、`weight`、`level` 作为可信输入。

## 6. 媒体和体态 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/media/upload-sessions` | 创建预签名上传任务 |
| `POST` | `/media/upload-sessions/{id}/complete` | 完成上传 |
| `DELETE` | `/media/assets/{id}` | 删除尚未进入报告的媒体 |
| `POST` | `/posture/sessions` | 创建体态任务 |
| `POST` | `/posture/sessions/{id}/views/{view}/attach` | 绑定上传资产 |
| `POST` | `/posture/sessions/{id}/submit` | 提交质量检查/分析 |
| `GET` | `/posture/sessions/{id}` | 查询进度和结果 |

创建体态任务请求：

```json
{
  "child_id": "0190...",
  "capture_protocol_version": "posture-capture-1.0",
  "consent_record_id": "0190...",
  "required_views": ["front", "back", "left", "right"]
}
```

结果必须区分：

```json
{
  "status": "completed",
  "quality": {
    "overall": "passed",
    "views": {
      "front": {"status": "passed", "score": 0.93},
      "back": {"status": "needs_retake", "reasons": ["occluded"]}
    }
  },
  "analysis": null,
  "next_action": "retake"
}
```

只要任一必需视角未通过，`analysis` 不得返回风险结论。

## 7. 报告 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/reports?child_id=` | 报告列表 |
| `GET` | `/reports/{id}` | 结构化报告 |
| `GET` | `/reports/{id}/download-url` | 短期下载地址 |
| `POST` | `/reports/{id}/regenerate` | 按同一输入和版本重渲染 |
| `POST` | `/reports/{id}/feedback` | 用户反馈 |

报告响应最少包含：

```json
{
  "id": "0190...",
  "report_type": "posture",
  "child_id": "0190...",
  "status": "ready",
  "knowledge_snapshot_id": "0190...",
  "algorithm_version": "posture-rule-1.0",
  "model_version": "pose-model-0.4.2",
  "limitations": ["普通照片不能诊断疾病"],
  "source_references": [
    {
      "title": "GB/T 16133-2014",
      "official_url": "https://std.samr.gov.cn/search/std?q=GB%2FT%2016133-2014"
    }
  ],
  "content": {}
}
```

## 8. 训练 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/training/plans` | 生成训练计划 |
| `GET` | `/training/plans/{id}` | 查询计划 |
| `POST` | `/training/plans/{id}/pause` | 安全暂停 |
| `POST` | `/training/items/{id}/logs` | 打卡 |
| `POST` | `/training/plans/{id}/feedback` | 训练反馈 |

生成计划请求必须带 `source_report_id`、目标、频次、时长和健康安全问卷版本。服务端先执行安全门禁，再调用内容编排/模型。

## 9. 咨询、语音和多模态 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/conversations` | 创建会话并绑定儿童范围 |
| `GET` | `/conversations/{id}/messages` | 分页消息 |
| `POST` | `/conversations/{id}/messages` | 发送文本/结构化上下文 |
| `POST` | `/speech/upload-sessions` | 语音上传 |
| `POST` | `/speech/tasks/{id}/confirm` | 确认转写 |
| `POST` | `/conversations/{id}/speak` | 生成语音播报 |
| `DELETE` | `/conversations/{id}` | 删除对话 |

消息请求：

```json
{
  "type": "text",
  "text": "这个指标下一周怎么练？",
  "context": {
    "report_ids": ["0190..."],
    "asset_ids": [],
    "consent_scope": "report_only"
  }
}
```

服务端返回 `citations`、`safety_state`、`next_action`，而不是只返回一段自然语言。

## 10. 管理和知识库 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/admin/knowledge/sources` | 登记来源 |
| `POST` | `/admin/knowledge/documents/upload` | 上传原文 |
| `POST` | `/admin/knowledge/versions/{id}/parse` | 解析候选 |
| `GET` | `/admin/knowledge/versions/{id}/diff` | 差异 |
| `POST` | `/admin/knowledge/versions/{id}/reviews` | 提交审核 |
| `POST` | `/admin/knowledge/versions/{id}/publish` | 发布 |
| `POST` | `/admin/knowledge/versions/{id}/withdraw` | 撤回 |
| `POST` | `/admin/knowledge/snapshots` | 创建发布快照 |

发布接口必须检查审核人数、角色分离、原文哈希、测试结果和适用范围冲突。

## 11. 状态轮询和 WebSocket

异步任务查询：

```text
GET /v1/jobs/{job_id}
```

返回 `queued/processing/succeeded/failed/cancelled`。客户端使用 1s、2s、4s、8s 退避，超过 60s 显示后台继续处理，不保持前台阻塞。

若使用 WebSocket：

- 连接必须带短期 access token；
- 只推送当前用户可见任务；
- 不通过消息推送原图和聊天全文；
- 断线后以 REST 状态为准。

## 12. API 安全验收

- [ ] 每个儿童资源都校验家庭数据范围和监护人授权。
- [ ] 所有写请求支持幂等，重复提交不产生重复任务。
- [ ] 返回错误不泄露标准原文版权内容、对象存储路径或内部模型提示词。
- [ ] 体态接口检查照片同意记录和删除状态。
- [ ] 管理 API 强制 MFA、角色分离和审计。
- [ ] OpenAPI 文档与实际错误码、字段和版本同步。
