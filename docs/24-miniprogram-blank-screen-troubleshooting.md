# 微信开发者工具预览白屏排查清单

## 1. 控制台报错（最直接）
打开微信开发者工具 → **调试器** → **Console** 面板，截图或复制所有红字错误。

常见致命错误：
- `TypeError: ... is not a function` —— 某个导入未定义或初始化失败
- `MiniProgramError: cannot read property 'X' of undefined` —— 服务端返回字段缺失
- `SyntaxError: Unexpected token` —— Taro 编译产物有 JS 兼容性问题
- `MiniProgramError: cannot find module './prebundle/X.js'` —— 编译产物残缺

## 2. Network 面板（最易被忽视）
调试器 → Network 标签：
- 看是否有红色 failed 请求（域名未配置 / 后端 500）
- 即使本地 dev-login 也需要 127.0.0.1:3000 在微信开发者工具 → 详情 → 本地设置勾选"不校验合法域名"

## 3. 项目设置检查
详情 → 本地设置：
- ✅ 不校验合法域名（**必须勾选**）
- ✅ ES6 转 ES5
- ❌ 不勾选"启用代码保护"（开发期会干扰调试）
- ❌ 不勾选"上传时压缩代码"（避免报错信息被吃掉）

## 4. 编译产物完整性
确认 dist 目录完整：
```
dist/
├── app.js, app.json, app.wxss
├── runtime.js
├── base.wxml
├── pages/home/{index.js, index.json, index.wxml}
├── assets/icons/sprite.svg
├── assets/tab/{home,assessment,training,family}{,-active}.png
└── 257.js, 835.js（chunks）
```

## 5. 清缓存
工具栏 → 清缓存 → **全部清除** → 重新编译 → 重新预览

## 6. 如果仍然白屏
按 F12 → Console 复制**完整堆栈**贴回给我。常见根因：

### 6.1 TabBar iconPath 404
某个 iconPath 不存在会导致 TabBar 渲染失败连带页面空白。
**已修复**：所有 iconPath 已用 PNG（src/assets/tab/）

### 6.2 异步初始化抛错
app.tsx 中 onNeedPrivacyAuthorization 在 3.8.0 触发会抛错。
**已修复**：try/catch 包裹，缺失时静默跳过

### 6.3 后端 API 网络失败
127.0.0.1:3000 在微信开发者工具中默认不可达。
**修复**：
1. 详情 → 本地设置 → 勾选"不校验合法域名"
2. 或者把后端暴露到公网 IP
3. 或者用 ngrok / cpolar 映射

### 6.4 Taro prebundle 缺失（最常见的 Taro 4 报错）
控制台会显示：
```
module 'prebundle/vendors-node_modules_taro_weapp_prebundle_react-dom_js.js' is not defined
```
**已修复**：build config 关闭 splitChunks + 启用 swc + dist/project.config.json 加 `lazyCodeLoading: false`

### 6.5 @tarojs/runtime 初始化失败
通常是 dist/runtime.js 缺失或被破坏。
**检查**：`dist/runtime.js` 存在且 > 1KB

## 7. 一键验证脚本
```bash
# 检查 dist 完整性
node -e "
const fs = require('fs');
const path = 'D:/boks/bokstice/apps/miniprogram/dist';
const checks = [
  'app.js', 'app.json', 'app.wxss', 'runtime.js',
  'assets/tab/home.png', 'assets/tab/assessment.png',
  'assets/tab/training.png', 'assets/tab/family.png',
  'assets/icons/sprite.svg',
  'pages/home/index.js', 'pages/home/index.wxml',
  'project.config.json',
];
for (const f of checks) {
  const ok = fs.existsSync(path + '/' + f);
  console.log((ok ? '✅' : '❌') + ' ' + f);
}
"
```