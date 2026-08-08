# BOKS 设计系统 / 微交互 / 图标资产化深化（增量深化 #3）

> **配套文档**：`docs/16` §1（UX/UI 8 维）、`docs/17` §阶段 6 + 9、`docs/07-ui-design.md`
> **审查基线**：2026-08-02（Asia/Shanghai）
> **范围**：`apps/miniprogram/src/{app.scss,tokens.scss,components,pages}`、`apps/mobile/lib/{theme.dart,screens.dart}`、`apps/admin/src/styles.css`
> **目标**：把"令牌存在但未贯穿 + 三端不统一 + 0 动画 + PNG TabBar"升级为"Style Dictionary SoT + 资产化图标 + Lottie 微交互 + dark mode + a11y 全覆盖"

---

## 目录

- [0. 当前代码快照](#0-当前代码快照)
- [1. 设计系统目标架构](#1-设计系统目标架构)
- [2. Style Dictionary + packages/design-tokens](#2-style-dictionary--packagesdesign-tokens)
- [3. 透明度 / 圆角 / 间距 / 阴影 token 化](#3-透明度--圆角--间距--阴影-token-化)
- [4. 图标系统资产化](#4-图标系统资产化)
- [5. 微交互与动画](#5-微交互与动画)
- [6. Lottie / Rive 资源库](#6-lottie--rive-资源库)
- [7. Dark Mode 全端贯通](#7-dark-mode-全端贯通)
- [8. 字体与排版](#8-字体与排版)
- [9. 无障碍（A11Y）端到端](#9-无障碍a11y端到端)
- [10. 组件库完整化清单](#10-组件库完整化清单)
- [11. 落地执行（接续 17 阶段 6 / 9）](#11-落地执行接续-17-阶段-6--9)

---

## 0. 当前代码快照

### 0.1 设计令牌现状

| 端 | 令牌源 | 关键证据 |
|---|---|---|
| miniprogram | `src/styles/tokens.scss` 64 行 | `$color-forest-950` … `$color-amber-700`（25 色），`$space-1..10`（8 级），`$radius-sm..xl`（5 级），`$font-display..caption`（6 级），`$ease-out / duration-fast..slow`（4 动效令牌） |
| Flutter | `lib/theme.dart` 175 行 | `Material 3 ColorScheme.fromSeed` + 5 个 BOKS 颜色 |
| Admin | `styles.css` 仅 3 个 CSS 变量 | — |
| **共享** | **0** | 三端手工同步 |

### 0.2 硬编码证据（必须修复）

`apps/miniprogram/src/app.scss` **960 行**，57 处硬编码颜色：

| 行 | 内容 | 性质 |
|---|---|---|
| 5 | `radial-gradient(circle at top right, rgba(169, 226, 141, 0.18), transparent 28%)` | 透明色硬编码 |
| 6 | `linear-gradient(180deg, #f5faf3 0%, $color-canvas 42%, #eaf4e8 100%)` | 十六进制硬编码 |
| 109 | `background: rgba(255, 255, 255, 0.96)` | 透明白色硬编码 |
| 129 | `color: #ffffff` | 白色硬编码 |
| 219-234 | 5 处 主题卡片背景硬编码 | — |
| 242-279 | 6 处 rgba/十六进制混合 | — |
| 362-388 | 边框 + 阴影硬编码 | — |
| 420-432 | 渐变硬编码 | — |
| 556-944 | ~20 处装饰层硬编码 | — |
| 1035 | `color: #ffffff` | — |
| 1045 | `border: 1px solid rgba(240, 216, 157, 0.9)` | — |

**完整列表**：见 `docs/16` §1.2 + 实地 `grep "rgba\\|#"` 共 57 命中。

### 0.3 图标系统现状

`apps/miniprogram/src/components/Icon.tsx:22-47` 内联 **16 个图标**（手写 SVG path），`TONES: 7 个 hex 硬编码`：

```tsx
const TONES: Record<IconTone, string> = {
  brand: "#1f6e45", forest: "#103e2f", sky: "#2c718a",
  amber: "#8a5a00", ink: "#315449", white: "#ffffff", danger: "#b42318"
};
```

- **致命缺陷**：`stroke="${color}"` 写死 hex，**无法跟随 dark mode / 主题色**。
- **致命缺陷**：`<Image src="data:image/svg+xml;base64...">` 在长列表场景下产生大量 base64 字符串拼接，渲染性能差。
- **致命缺陷**：TabBar 用 `assets/tab/*.png`（8 个 PNG），**dark mode 下无反相**。

### 0.4 动画现状

```
miniprogram: app.scss 含 page-enter / prefers-reduced-motion 全局兜底
Flutter:     grep "AnimationController|Tween|Hero|AnimatedSwitcher" 0 命中
Admin:       0 动画
Celebration: 0（训练完成、体测出分）
CountUp:     0
Skeleton:    0
```

### 0.5 组件库现状

| 端 | 共享组件数 | 缺口 |
|---|---|---|
| miniprogram | **3**（ChildPicker、Icon、PageState） | Button / Input / Card / Tag / Avatar / Modal / Toast / Skeleton / Empty / PullRefresh / Tabs / Picker / DatePicker / Stepper / Rate / Progress / Carousel / Accordion / BottomSheet / SearchBar / SegmentedControl / Timeline 全部缺失 |
| Flutter | **0**（全部内联 `screens.dart` 2684 行） | Loading 在 4+ 处重复 |
| Admin | **0** 业务组件 | 无 DataGrid / Sidebar / EmptyState / Toast |

---

## 1. 设计系统目标架构

```
                  ┌──────────────────────────────────────┐
                  │   Figma (SoT)                        │
                  │   • Color / Typography / Spacing    │
                  │   • Component Specs / A11y Notes     │
                  └────────────────┬─────────────────────┘
                                   │ Style Dictionary export
                  ┌────────────────▼─────────────────────┐
                  │   packages/design-tokens             │
                  │   tokens.json (canonical)            │
                  │   ├── color.{brand|forest|...}       │
                  │   ├── alpha.{overlay|scrim|...}      │
                  │   ├── space.{1..10}                  │
                  │   ├── radius.{sm..pill}              │
                  │   ├── shadow.{xs..hero}              │
                  │   ├── duration.{fast..slow}          │
                  │   ├── easing.{out|inOut|...}         │
                  │   ├── font.{display..caption}        │
                  │   ├── motion.{spring|...}            │
                  │   └── zIndex.{base|modal|toast|...}  │
                  └──┬─────────────┬─────────────┬───────┘
                     │             │             │
        ┌────────────▼─┐  ┌────────▼────────┐ ┌─▼────────────┐
        │ SCSS build   │  │ Dart build      │ │ CSS build    │
        │ (miniprogram)│  │ (Flutter)       │ │ (Admin)      │
        └──────────────┘  └─────────────────┘ └──────────────┘
                     │             │             │
        ┌────────────▼─────────────▼─────────────▼───────┐
        │ Component libraries (各端)                       │
        │   BoksButton / Input / Card / Tag / Avatar ... │
        └──────────────────────────────────────────────────┘
```

---

## 2. Style Dictionary + packages/design-tokens

### 2.1 包结构

```
packages/design-tokens/
├── package.json            # style-dictionary, sd-transforms
├── sd.config.cjs           # 三端构建配置
├── tokens/
│   ├── color.json          # 25 品牌色 + 语义色
│   ├── alpha.json          # 12 个 alpha token
│   ├── space.json          # 8 级 + 容器 4 级
│   ├── radius.json
│   ├── shadow.json
│   ├── typography.json
│   ├── motion.json         # duration + easing
│   ├── zindex.json
│   └── semantic.json       # 语义映射（bg/primary/text/...）
├── build/
│   ├── scss/_tokens.scss           # miniprogram
│   ├── dart/boks_tokens.dart       # Flutter
│   ├── css/variables.css           # Admin
│   └── ts/tokens.ts                # 类型导出
└── README.md
```

### 2.2 核心 token 文件

```json
// tokens/color.json
{
  "color": {
    "brand": {
      "50":  { "value": "#f4faf3" },
      "100": { "value": "#e8f6e6" },
      "300": { "value": "#a4df9a" },
      "500": { "value": "#4faf68" },
      "600": { "value": "#2e8b57" },
      "700": { "value": "#1f6e45" },
      "800": { "value": "#18533e" },
      "900": { "value": "#103e2f" },
      "950": { "value": "#0a2a20" }
    },
    "forest": { "900": { "value": "#103e2f" } /* ... */ },
    "sky":    { /* ... */ },
    "amber":  { /* ... */ },
    "ink":    { "500": {...}, "600": {...}, "700": {...}, "800": {...}, "900": {...} },
    "danger": { "50": {...}, "100": {...}, "600": {...} },
    "surface": {
      "white":  { "value": "#ffffff" },
      "soft":   { "value": "#f7fbf6" },
      "canvas": { "value": "#eef6ec" },
      "border": { "value": "#d7e6db" }
    },
    "white": { "value": "#ffffff" }
  }
}
```

```json
// tokens/semantic.json (dark mode 关键)
{
  "semantic": {
    "color": {
      "bg":           { "value": "{color.surface.canvas}" },
      "bg-elevated":  { "value": "{color.surface.white}" },
      "bg-inverse":   { "value": "{color.forest.900}" },
      "text":         { "value": "{color.ink.900}" },
      "text-muted":   { "value": "{color.ink.600}" },
      "text-inverse": { "value": "{color.white}" },
      "border":       { "value": "{color.surface.border}" },
      "primary":      { "value": "{color.brand.700}" },
      "primary-hover":{ "value": "{color.brand.800}" },
      "danger":       { "value": "{color.danger.600}" }
    }
  }
}
```

```json
// tokens/alpha.json (解决 57 处硬编码)
{
  "alpha": {
    "overlay-light": { "value": "rgba(255, 255, 255, 0.96)" },
    "overlay-mid":   { "value": "rgba(255, 255, 255, 0.85)" },
    "overlay-soft":  { "value": "rgba(255, 255, 255, 0.60)" },
    "scrim-strong":  { "value": "rgba(10, 42, 32, 0.72)" },
    "scrim-mid":     { "value": "rgba(10, 42, 32, 0.48)" },
    "tint-brand":    { "value": "rgba(46, 139, 87, 0.08)" },
    "tint-brand-strong": { "value": "rgba(46, 139, 87, 0.35)" },
    "tint-sky":      { "value": "rgba(43, 111, 134, 0.08)" },
    "tint-amber":    { "value": "rgba(138, 90, 0, 0.08)" },
    "tint-danger":   { "value": "rgba(180, 35, 24, 0.10)" },
    "border-soft":   { "value": "rgba(215, 230, 219, 0.90)" },
    "border-strong": { "value": "rgba(46, 139, 87, 0.55)" }
  }
}
```

```json
// tokens/motion.json
{
  "duration": {
    "instant":  { "value": "80ms" },
    "fast":     { "value": "160ms" },
    "base":     { "value": "240ms" },
    "slow":     { "value": "360ms" },
    "deliberate":{ "value": "480ms" }
  },
  "easing": {
    "out":     { "value": "cubic-bezier(0.22, 1, 0.36, 1)" },
    "in":      { "value": "cubic-bezier(0.64, 0, 0.78, 0)" },
    "in-out":  { "value": "cubic-bezier(0.83, 0, 0.17, 1)" },
    "spring":  { "value": "cubic-bezier(0.34, 1.56, 0.64, 1)" }
  },
  "zIndex": {
    "base":   { "value": 1 },
    "sticky": { "value": 100 },
    "modal":  { "value": 1000 },
    "toast":  { "value": 1100 },
    "tooltip":{ "value": 1200 }
  }
}
```

### 2.3 构建脚本（`sd.config.cjs`）

```js
const StyleDictionary = require("style-dictionary");
const fs = require("fs");

StyleDictionary.registerTransform({
  name: "size/rem",
  type: "value",
  matcher: (prop) => prop.attributes.category === "size",
  transformer: (prop) => `${parseFloat(prop.value) / 16}rem`,
});

const base = {
  source: ["tokens/**/*.json"],
  platforms: {
    scss: {
      transformGroup: "scss",
      buildPath: "build/scss/",
      files: [{ destination: "_tokens.scss", format: "scss/variables" }],
    },
    dart: {
      transformGroup: "js",
      buildPath: "build/dart/",
      files: [{ destination: "boks_tokens.dart", format: "dart/class" }],
    },
    css: {
      transformGroup: "css",
      buildPath: "build/css/",
      files: [{ destination: "variables.css", format: "css/variables" }],
    },
    ts: {
      transformGroup: "js",
      buildPath: "build/ts/",
      files: [{ destination: "tokens.ts", format: "javascript/module-flat" }],
    },
  },
};

const sd = new StyleDictionary(base);
sd.buildAllPlatforms();
```

### 2.4 必须新增

| 文件 | 作用 |
|---|---|
| `packages/design-tokens/package.json` | sd 依赖 |
| `packages/design-tokens/sd.config.cjs` | 构建 |
| `packages/design-tokens/tokens/*` | 12 个 token 文件 |
| `packages/design-tokens/build/*` | 三端产物 |

---

## 3. 透明度 / 圆角 / 间距 / 阴影 token 化

### 3.1 app.scss 57 处硬编码整改清单

**规则**：所有 `rgba(255, 255, 255, X)` → `var(--alpha-overlay-X)` 或对应 token。
所有 `#xxxxxx` → `var(--color-xxx)`。

| 原行 | 原值 | 改后 token |
|---|---|---|
| 5 | `rgba(169, 226, 141, 0.18)` | `--alpha-tint-brand-light` |
| 109 | `rgba(255, 255, 255, 0.96)` | `--alpha-overlay-light` |
| 129 | `#ffffff` | `--color-text-inverse` |
| 219 | `#f3fbf1` | `--color-surface-soft` |
| 220 | `rgba(46, 139, 87, 0.08)` | `--alpha-tint-brand` |
| 224 | `#1a5743` | `--color-brand-800` |
| 242 | `rgba(255, 255, 255, 0.16)` | `--alpha-overlay-soft` |
| 257 | `rgba(255, 255, 255, 0.98)` | `--alpha-overlay-light` |
| 272 | `rgba(46, 139, 87, 0.35)` | `--alpha-tint-brand-strong` |
| 363 | `rgba(46, 139, 87, 0.12)` | `--alpha-tint-brand-soft` |
| 388 | `rgba(215, 230, 219, 0.9)` | `--alpha-border-soft` |
| 420 | `#1b6b49` | `--color-brand-700` |
| 432 | `rgba(255, 255, 255, 0.18)` | `--alpha-overlay-mid` |
| 516 | `rgba(46, 139, 87, 0.35)` | `--alpha-tint-brand-strong` |
| 525 | `rgba(255, 255, 255, 0.9)` | `--alpha-overlay-light` |
| 538 | `rgba(43, 111, 134, 0.35)` | `--alpha-tint-sky-strong` |
| 556 | `rgba(255, 255, 255, 0.92)` | `--alpha-overlay-light` |
| 593 | `#eef8ec` | `--color-surface-soft` |
| 599 | `rgba(255, 255, 255, 0.96)` | `--alpha-overlay-light` |
| 627 | `rgba(164, 223, 154, 0.28)` | `--alpha-tint-brand-light` |
| 628 | `#1b6848` | `--color-brand-700` |
| 631 | `#ffffff` | `--color-text-inverse` |
| 639 | `rgba(255, 255, 255, 0.08)` | `--alpha-overlay-soft` |
| 665 | `rgba(0, 0, 0, 0.12)` | `--alpha-scrim-mid` |
| 676 | `rgba(232, 246, 230, 0.82)` | `--color-text-on-primary` |
| 705 | `rgba(255, 255, 255, 0.14)` | `--alpha-overlay-soft` |
| 706 | `rgba(255, 255, 255, 0.12)` | `--alpha-overlay-soft` |
| 716 | `rgba(255, 255, 255, 0.12)` | `--alpha-overlay-soft` |
| 733 | `rgba(232, 246, 230, 0.84)` | `--color-text-on-primary` |
| 744 | `rgba(232, 246, 230, 0.78)` | `--color-text-on-primary` |
| 750 | `rgba(255, 255, 255, 0.12)` | `--alpha-overlay-soft` |
| 751 | `rgba(255, 255, 255, 0.18)` | `--alpha-overlay-mid` |
| 752 | `rgba(255, 255, 255, 0.98)` | `--alpha-overlay-light` |
| 756 | `rgba(255, 255, 255, 0.98)` | `--alpha-overlay-light` |
| 829 | `rgba(215, 230, 219, 0.9)` | `--alpha-border-soft` |
| 885 | `rgba(255, 255, 255, 0.98)` | `--alpha-overlay-light` |
| 897 | `rgba(46, 139, 87, 0.35)` | `--alpha-tint-brand-strong` |
| 933 | `rgba(46, 139, 87, 0.22)` | `--alpha-tint-brand-soft` |
| 944 | `rgba(255, 255, 255, 0.98)` | `--alpha-overlay-light` |
| 1045 | `rgba(240, 216, 157, 0.9)` | `--alpha-tint-amber-soft` |

**验收**：`grep "rgba\\|#" apps/miniprogram/src/app.scss` 命中 ≤ 5（仅注释 / 渐变内部）。

---

## 4. 图标系统资产化

### 4.1 选型决策

| 选项 | 优点 | 缺点 | 决策 |
|---|---|---|---|
| **Lucide（开源 MIT，~1400 图标）** | 风格统一、currentColor、双色可用、tree-shake | 部分图标语义与儿童场景不贴 | **采用（主）** |
| Tabler Icons | 700+，圆润 | — | 备选 |
| 自绘 SVG | 完全可控 | 工作量大 | 仅定制 5-10 个（健康/体测/儿童专属） |

### 4.2 资源化方案

```
apps/miniprogram/src/assets/icons/
├── sprite.svg                    # SVG sprite（主资源）
├── home.svg                      # 16 个图标独立文件（备用）
├── assessment.svg
└── ...
```

**SVG sprite 用法**：
```html
<svg class="icon" aria-hidden="true">
  <use href="/assets/icons/sprite.svg#home" />
</svg>
```

CSS：
```scss
.icon { width: 1em; height: 1em; fill: currentColor; stroke: currentColor; stroke-width: 1.8; }
```

**关键**：用 `currentColor` 透传父元素颜色 → dark mode 自动跟随。

### 4.3 Flutter 等价实现

```dart
// packages/boks_icons/lib/boks_icons.dart
import 'package:flutter/material.dart';

class BoksIcon {
  static const IconData home        = IconData(0xe900, fontFamily: 'BoksIcons');
  static const IconData assessment  = IconData(0xe901, fontFamily: 'BoksIcons');
  // ...
}

// icons.dart 通过 flutter iconfont 工具生成
```

字体子集化：仅打包用到的图标（≤ 30 KB）。

### 4.4 TabBar 图标升级（当前 PNG）

**现问题**：`apps/miniprogram/src/assets/tab/*.png`（8 个 PNG）dark mode 下无法反相，且像素不清晰。

**新方案**：使用 SVG sprite + `colorFilter`：
```ts
const tabIcons = {
  home:      { active: '#1f6e45', inactive: '#72867d' },
  assessment:{ active: '#1f6e45', inactive: '#72867d' },
  posture:   { active: '#1f6e45', inactive: '#72867d' },
  training:  { active: '#1f6e45', inactive: '#72867d' },
  family:    { active: '#1f6e45', inactive: '#72867d' },
};
```

或在自定义 tabBar（`custom: true`）中渲染 `<svg>`。

### 4.5 必须新增 / 修改

| 文件 | 作用 |
|---|---|
| `apps/miniprogram/src/assets/icons/sprite.svg` | 主图标 sprite |
| `apps/miniprogram/src/components/Icon.tsx` | 改用 `currentColor` 透传 |
| `apps/miniprogram/src/app.config.ts` | TabBar 改为 custom + SVG |
| `apps/mobile/lib/boks_icons.dart` | Flutter 图标字体 |
| `apps/admin/src/components/Icon.tsx` | 同 miniprogram |
| `packages/design-tokens/build/icons-manifest.json` | 共享图标清单 |

---

## 5. 微交互与动画

### 5.1 动画语言（Motion Principles）

| 类别 | 持续 | 缓动 | 用途 |
|---|---|---|---|
| **微反馈** | 80-160ms | `out` | 按钮按下、勾选、切换 |
| **状态切换** | 240ms | `in-out` | Tab 切换、面板展开 |
| **页面转场** | 360ms | `out` | 页面进入/退出 |
| **数字 / 进度** | 600-1200ms | `out` | CountUp、Progress |
| **庆祝** | 1500ms + Lottie | `spring` | 训练完成打卡、体测出分 |
| **加载骨架** | 1200ms loop | linear | Shimmer |

### 5.2 实现清单

#### 5.2.1 miniprogram

```scss
// app.scss
@media (prefers-reduced-motion: no-preference) {
  .fade-in   { animation: fade-in var(--duration-base) var(--easing-out) both; }
  .slide-up  { animation: slide-up var(--duration-slow) var(--easing-out) both; }
  .shimmer   { background: linear-gradient(90deg, #f0f0f0 0%, #f8f8f8 50%, #f0f0f0 100%);
               background-size: 200% 100%;
               animation: shimmer 1.2s infinite; }
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
```

**页面转场**：`page-enter` 已存在（`app.scss:46-:51`），新增 `page-slide-up` / `page-fade`。

#### 5.2.2 Flutter

引入 `flutter_animate`：

```dart
// pubspec.yaml
dependencies:
  flutter_animate: ^4.5.0

// usage
Widget build(BuildContext context) {
  return Card(child: Text('体测成绩'))
    .animate()
    .fadeIn(duration: 240.ms, curve: Curves.easeOutCubic)
    .slideY(begin: 0.1, end: 0);
}
```

全局 `MaterialApp` 配置：
```dart
MaterialApp(
  theme: boksTheme(),
  builder: (context, child) {
    return MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: MediaQuery.textScalerOf(context).clamp(minScaleFactor: 1.0, maxScaleFactor: 1.3)),
      child: child!,
    );
  },
);
```

### 5.3 必做组件

| 组件 | miniprogram | Flutter | Admin |
|---|---|---|---|
| `<BoksSkeleton/>` shimmer | ✓ | ✓ | ✓ |
| `<CountUp value={n}/>` | ✓ | ✓ | ✓ |
| `<BoksProgress/>` | ✓ | ✓ | ✓ |
| `<Celebrate/>` Lottie | ✓ | ✓ | — |
| `<PressScale/>` 按压缩放 | — | ✓ | ✓ |
| `<PullRefresh/>` | ✓ | — | — |
| `<EmptyState/>` 插画 | ✓ | ✓ | ✓ |
| `<ErrorBoundary/>` | ✓ | ✓（ErrorWidget.builder） | ✓ |

### 5.4 CountUp 实现要点

```tsx
// miniprogram/components/CountUp.tsx
export function CountUp({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);  // easeOutCubic
      setDisplay(value * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <Text>{display.toFixed(0)}</Text>;
}
```

Flutter 版本：`flutter_animate` + `Tween<double>`。

### 5.5 完成庆祝动画

**场景**：训练完成、体测出分、首颗勋章解锁。

**Lottie 资源**：
- `assets/lottie/celebrate-burst.json`（礼花 + 1.5s 渐隐）
- `assets/lottie/medal-unlock.json`（勋章旋转展开）
- `assets/lottie/assessment-success.json`（数字弹跳 + 彩带）

调用：
```tsx
<Celebrate trigger={assessment.just_submitted}>
  <LottieView source="assets/lottie/celebrate-burst.json" autoplay loop={false} />
</Celebrate>
```

---

## 6. Lottie / Rive 资源库

### 6.1 资源清单（≥ 15 个）

| 类别 | 资源 | 用途 | 大小控制 |
|---|---|---|---|
| 加载 | `loading-leaf.json` | 加载态（叶子旋转） | < 30 KB |
| 加载 | `loading-pulse.json` | 脉冲 | < 20 KB |
| 空态 | `empty-family.json` | 家庭空插画 | < 50 KB |
| 空态 | `empty-report.json` | 报告空插画 | < 50 KB |
| 空态 | `empty-search.json` | 搜索空 | < 40 KB |
| 庆祝 | `celebrate-burst.json` | 完成礼花 | < 100 KB |
| 庆祝 | `celebrate-medal.json` | 勋章解锁 | < 80 KB |
| 庆祝 | `assessment-success.json` | 体测出分 | < 120 KB |
| 体态 | `posture-front.json` | 正面体态示意图 | < 60 KB |
| 体态 | `posture-side.json` | 侧面体态示意图 | < 60 KB |
| 体态 | `posture-photo-frame.json` | 四视角拍摄框 | < 50 KB |
| 训练 | `training-warmup.json` | 热身引导 | < 80 KB |
| 训练 | `training-stretch.json` | 拉伸 | < 80 KB |
| 训练 | `training-balance.json` | 平衡示范 | < 60 KB |
| 错误 | `error-soft.json` | 错误状态插画 | < 50 KB |

### 6.2 性能红线

- 单 Lottie ≤ 120 KB
- 不在长列表中用 Lottie（用 SVG / icon）
- 仅在触发时（trigger）加载
- 全部支持 `prefers-reduced-motion` 退化（静态帧）

### 6.3 必须新增

```
apps/miniprogram/src/assets/lottie/*.json     # ≥ 15 个
apps/mobile/assets/lottie/*.json              # 同源
apps/admin/src/assets/lottie/*.json           # 部分
packages/design-tokens/build/motion.json     # 动效 token
```

---

## 7. Dark Mode 全端贯通

### 7.1 配色策略

| 语义 | Light | Dark |
|---|---|---|
| `bg` | `#eef6ec` | `#0a1f1a` |
| `bg-elevated` | `#ffffff` | `#10302a` |
| `bg-inverse` | `#0a2a20` | `#f7fbf6` |
| `text` | `#142c25` | `#e8f6e6` |
| `text-muted` | `#5b7168` | `#a4b8b0` |
| `text-inverse` | `#ffffff` | `#0a2a20` |
| `border` | `#d7e6db` | `#1f4438` |
| `primary` | `#1f6e45` | `#4faf68` |
| `danger` | `#b42318` | `#ff7a6e` |
| `warning` | `#8a5a00` | `#ffc864` |

### 7.2 实现

#### miniprogram

```scss
// app.scss
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0a1f1a;
    --color-bg-elevated: #10302a;
    --color-text: #e8f6e6;
    /* ... */
  }
}

// 显式切换
.theme-dark {
  --color-bg: #0a1f1a;
  /* ... */
}
```

小程序需通过 `wx.getSystemInfoSync()` 读取 + 用户手动切换（提供 3 档：跟随系统/亮/暗）。

#### Flutter

```dart
// lib/theme.dart
class BoksTheme {
  static ThemeData light() => ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: BoksTokens.brand700, brightness: Brightness.light),
    extensions: const [BoksPalette.light],
  );
  static ThemeData dark() => ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: BoksTokens.brand500, brightness: Brightness.dark),
    extensions: const [BoksPalette.dark],
  );
}
```

#### Admin

```css
:root { /* light */ }
@media (prefers-color-scheme: dark) { :root { /* dark */ } }
html.theme-dark { /* override */ }
```

### 7.3 必须新增

| 文件 | 作用 |
|---|---|
| `packages/design-tokens/tokens/semantic.json` | dark 变量 |
| `packages/design-tokens/tokens/theme-dark.json` | dark 主题 |
| `apps/miniprogram/src/app.scss` | media query + 三档切换 |
| `apps/mobile/lib/theme.dart` | BoksPalette + light/dark |
| `apps/admin/src/styles.css` | dark 变量 |
| `apps/miniprogram/src/services/theme.ts` | 跟随系统 + 手动切换 |

### 7.4 验收

- 截图：light vs dark 各 6 屏
- token 字段一致率 100%（三端同一 token 名指向不同色值）

---

## 8. 字体与排版

### 8.1 字体选型

| 端 | 字体 | 来源 | 备注 |
|---|---|---|---|
| miniprogram | 系统默认（PingFang SC / HarmonyOS Sans / Microsoft YaHei） | 系统 | 不打包字体 |
| Flutter | `google_fonts` 系统回退 | 系统 | 优化中文 |
| Admin | `Inter`（西文）+ `PingFang SC`（中文） | 系统 | 优化数字 |

### 8.2 排版尺度

| 用途 | miniprogram | Flutter | Admin |
|---|---|---|---|
| Display | 28 / 36 line-height | headlineMedium 28 | 32 / 40 |
| Title | 22 / 30 | titleLarge 22 | 22 / 30 |
| Section | 17 / 24 | titleMedium 17 | 17 / 24 |
| Body | 15 / 22 | bodyMedium 15 | 15 / 22 |
| Meta | 13 / 18 | bodySmall 13 | 13 / 18 |
| Caption | 12 / 16 | labelSmall 12 | 12 / 16 |

字号支持用户缩放（动态类型）：
- miniprogram：`font-size: rpx(15px);`，跟随 `wx.getSystemInfoSync().fontSizeSetting`
- Flutter：`MediaQuery.textScalerOf(context).clamp(minScaleFactor: 1.0, maxScaleFactor: 1.3)`
- Admin：CSS `font-size: clamp(...)`

### 8.3 数字优化

- 体测成绩使用 `font-variant-numeric: tabular-nums`（数字等宽，对齐更好）

---

## 9. 无障碍（A11Y）端到端

### 9.1 WCAG 2.1 AA 验收对照

| 维度 | 目标 | 当前 | 必须完成 |
|---|---|---|---|
| 文本对比度 ≥ 4.5:1 | 100% | 推测 60% | 全面 token 化后审计（自动 + 人工） |
| 大文本对比度 ≥ 3:1 | 100% | — | 同上 |
| 触控目标 ≥ 44×44pt | 100% | 推测 50% | 大量 `View onClick` 加 `min-height: 88rpx` |
| 键盘可访问 | 100% | 推测 10% | Admin 全部交互 Tab 可达 + 焦点环 |
| 屏幕阅读器语义 | 100% | **0%** | `grep "aria-label" 0 命中` → 全量补充 |
| `prefers-reduced-motion` | 100% | 仅 miniprogram 全局 | Flutter `AnimationConfig` + Admin `prefers-reduced-motion` |
| 字号缩放 | 100% | 0% | 见 §8.2 |
| `prefers-color-scheme` | 100% | 0% | 见 §7 |
| `lang="zh-CN"` | 100% | 部分 | Admin `<html lang="zh-CN">` |

### 9.2 必须规则

```tsx
// miniprogram 组件示例
<View
  role="button"
  aria-label="查看体测报告"
  aria-pressed={pressed}
  tabIndex={0}
  onClick={handle}
  style={{ minWidth: '88rpx', minHeight: '88rpx' }}
>
  ...
</View>
```

```dart
// Flutter
Semantics(
  button: true,
  label: '查看体测报告',
  child: InkWell(onTap: ..., child: ...),
)
```

### 9.3 Admin 焦点环

```css
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--color-bg-elevated);
  padding: var(--space-3) var(--space-4);
  z-index: var(--zIndex-tooltip);
}
.skip-link:focus {
  left: var(--space-4);
  top: var(--space-4);
}
```

### 9.4 测试矩阵

| 测试 | miniprogram | Flutter | Admin |
|---|---|---|---|
| 自动 a11y 扫描 | `@axe-core/playwright` | `flutter_test` a11y | `@axe-core/playwright` |
| 屏幕阅读器人工 | VoiceOver (iOS) | TalkBack | NVDA |
| 键盘导航人工 | — | — | Chrome / Safari |

---

## 10. 组件库完整化清单

### 10.1 必须组件（miniprogram ≥ 12 + Flutter ≥ 12 + Admin ≥ 8）

#### miniprogram `apps/miniprogram/src/components/`

| 组件 | 状态 | 优先级 | 备注 |
|---|---|---|---|
| `BoksButton` | 待建 | P0 | primary/secondary/ghost/danger 四态 |
| `BoksInput` | 待建 | P0 | 含错误状态、helper text |
| `BoksCard` | 待建 | P0 | 卡片基础 |
| `BoksTag` | 待建 | P0 | 标签 |
| `BoksAvatar` | 待建 | P0 | 头像 + 字母兜底 |
| `BoksEmpty` | 待建 | P0 | 空状态 |
| `BoksLoading` | 待建 | P0 | Loading |
| `BoksSkeleton` | 待建 | P0 | 骨架 |
| `BoksModal` | 待建 | P0 | 弹窗 |
| `BoksToast` | 待建 | P0 | 轻提示 |
| `BoksTabs` | 待建 | P1 | Tabs |
| `BoksPicker` | 待建 | P1 | 单/多选 |
| `BoksDatePicker` | 待建 | P1 | 日期选择 |
| `BoksStepper` | 待建 | P1 | 计数器 |
| `BoksRate` | 待建 | P2 | 评分 |
| `BoksProgress` | 待建 | P1 | 进度 |
| `BoksCarousel` | 待建 | P2 | 轮播 |
| `BoksAccordion` | 待建 | P1 | 折叠 |
| `BoksBottomSheet` | 待建 | P1 | 抽屉 |
| `BoksSearchBar` | 待建 | P1 | 搜索 |
| `BoksSegmentedControl` | 待建 | P2 | 分段 |
| `BoksTimeline` | 待建 | P1 | 时间线 |
| `BoksCelebrate` | 待建 | P1 | Lottie 容器 |
| `BoksCountUp` | 待建 | P1 | 数字滚动 |
| `BoksErrorBoundary` | 待建 | P0 | 错误兜底 |
| `ChildPicker`（已有） | ✓ | — | 复用 |
| `Icon`（已有） | 改 | — | 改 currentColor |
| `PageState`（已有） | 改 | — | 扩三态 + 插画 |

#### Flutter `apps/mobile/lib/widgets/`

| 组件 | 状态 | 优先级 |
|---|---|---|
| `BoksButton` | 待建 | P0 |
| `BoksCard` | 待建 | P0 |
| `BoksInput` | 待建 | P0 |
| `BoksTag` | 待建 | P0 |
| `BoksAvatar` | 待建 | P0 |
| `BoksEmpty` | 待建 | P0 |
| `BoksLoading` | 待建 | P0 |
| `BoksSkeleton` | 待建 | P0 |
| `BoksModal` | 待建 | P0 |
| `BoksToast` | 待建 | P0 |
| `BoksCelebrate` | 待建 | P1 |
| `BoksCountUp` | 待建 | P1 |
| `BoksErrorBoundary` | 待建 | P0 |

#### Admin `apps/admin/src/components/`

| 组件 | 状态 | 优先级 |
|---|---|---|
| `DataGrid` | 待建 | P0 |
| `Sidebar` | 待建 | P0 |
| `TopBar` | 待建 | P0 |
| `EmptyState` | 待建 | P0 |
| `Toast` | 待建 | P0 |
| `Modal` | 待建 | P0 |
| `Pagination` | 待建 | P0 |
| `Tabs` | 待建 | P1 |
| `FormField` | 待建 | P0 |
| `Badge` | 待建 | P1 |

### 10.2 Storybook / 组件市场

- miniprogram：Taro Storybook
- Flutter：`storybook_flutter`
- Admin：Storybook 7 + Vite

---

## 11. 落地执行（接续 17 阶段 6 / 9）

> 与 `docs/17` §阶段 6 / 9 并行扩展；**新增**任务用 `[NEW]` 标注。

| 周次 | 任务 | 交付物 | 验收 |
|---|---|---|---|
| W1 D1-3 | 初始化 `packages/design-tokens` + sd.config | 12 个 token 文件 + 4 端产物 | 字段一致率 100% |
| W1 D4-5 | miniprogram `app.scss` 57 处硬编码 → token | `app.scss` 全文 | grep rgba/# ≤ 5 |
| W2 D1-3 | Flutter ThemeExtension + dark mode | `theme.dart` 全量重构 | magic number < 5 |
| W2 D4-5 | Admin CSS 变量扩充到 ≥ 30 + dark | `styles.css` | 变量 ≥ 30 |
| W3 D1-3 | 图标 sprite.svg 制作（16+ Lucide 移植） | `sprite.svg` | currentColor 透传 100% |
| W3 D4-5 | TabBar 改 SVG + custom | `app.config.ts` | dark mode 切色正常 |
| W4 D1-3 | Flutter BoksIcons 字体子集化 | `boks_icons.dart` + .ttf | 子集 ≤ 30 KB |
| W4 D4-5 | **[NEW]** Flutter 引入 flutter_animate | pubspec + 全局 builder | 屏幕切换 100% 动效 |
| W5 D1-3 | 通用组件 miniprogram 12 个 | `components/` | 基础组件 ≥ 12 |
| W5 D4-5 | Flutter 通用组件 8 个 | `widgets/` | 同上 |
| W6 D1-3 | Lottie 资源 15 个 | `assets/lottie/` | 总大小 ≤ 800 KB |
| W6 D4 | **[NEW]** Skeleton + CountUp + Celebration | 三端 | 覆盖率 100% |
| W6 D5 | **[NEW]** 三态组件（Empty / Error / Loading） | 各端 12 页面 | 三态覆盖率 95%+ |
| W7 D1-3 | a11y 全面审查 + aria-label 补齐 | 全代码 | 覆盖率 100% |
| W7 D4-5 | 触控目标合规 + 44×44 审计 | 全代码 | 合规率 100% |
| W8 D1-2 | Dark Mode 端到端 | 三端 12 屏截图 | 字段一致率 100% |
| W8 D3-4 | 字号缩放兼容 | 三端 | clamp(minScaleFactor: 1.0, maxScaleFactor: 1.3) |
| W8 D5 | Storybook 三端 | 3 个 Storybook | 组件覆盖率 ≥ 90% |

**人力**：
- 1 名设计/UX × 8 周
- 1 名 Flutter 工程师 × 6 周（与 17 阶段 7 复用）
- 1 名小程序工程师 × 6 周
- 1 名 Web/Admin 工程师 × 4 周
- 1 名 QA × 4 周（a11y + dark mode + 字号缩放测试）

---

## 附录 A：硬编码 → token 映射表（速查）

| 类别 | 原写法 | 新写法 |
|---|---|---|
| 主题白 | `rgba(255,255,255,0.96)` | `var(--alpha-overlay-light)` |
| 主题白半透 | `rgba(255,255,255,0.85)` | `var(--alpha-overlay-mid)` |
| 主题白弱透 | `rgba(255,255,255,0.60)` | `var(--alpha-overlay-soft)` |
| 主题绿弱 | `rgba(46,139,87,0.08)` | `var(--alpha-tint-brand)` |
| 主题绿强 | `rgba(46,139,87,0.55)` | `var(--alpha-tint-brand-strong)` |
| 主题绿中 | `rgba(46,139,87,0.35)` | `var(--alpha-tint-brand-strong)` |
| 主题蓝弱 | `rgba(43,111,134,0.08)` | `var(--alpha-tint-sky)` |
| 主题橙弱 | `rgba(138,90,0,0.08)` | `var(--alpha-tint-amber)` |
| 主题红弱 | `rgba(180,35,24,0.10)` | `var(--alpha-tint-danger)` |
| 边框弱 | `rgba(215,230,219,0.90)` | `var(--alpha-border-soft)` |
| 主白 | `#ffffff` | `var(--color-text-inverse)` |
| 主题绿 700 | `#1f6e45` | `var(--color-brand-700)` |
| 主题绿 800 | `#1a5743` | `var(--color-brand-800)` |
| 主题绿 900 | `#103e2f` | `var(--color-brand-900)` |

---

> **下一步**：本方案审批后，启动阶段 6 第一周（建 `packages/design-tokens`）；阶段 9 在阶段 6 后启动（a11y + dark + 字号缩放）。