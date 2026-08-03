import { defineConfig, type UserConfigExport } from "@tarojs/cli";

const config: UserConfigExport = {
  projectName: "boks-miniprogram",
  date: "2026-08-01",
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: "src",
  outputRoot: "dist",
  framework: "react",
  compiler: "webpack5",
  plugins: [
    "@tarojs/plugin-platform-weapp",
    "@tarojs/plugin-platform-h5",
  ],
  copy: {
    patterns: [
      { from: "src/assets/icons/", to: "assets/icons/" },
      { from: "src/assets/tab/", to: "assets/tab/" },
    ],
  },
  mini: {
    // 关闭代码分块，但保留独立 runtime chunk（必需）
    webpackChain(chain: any) {
      chain.optimization.splitChunks(false);
      // 显式输出独立 runtime.js
      chain.optimization.runtimeChunk("single");
      // 关闭 webpack5 mangleExports：避免 taroWindowProvider 等模块 exports
      // 被混淆为 "mw" 等短变量后与 page chunk 内的局部变量名冲突（导致
      // `f.mw.trigger(...)` 抛 `Cannot set properties of undefined`）。
      // 该漏洞源于 miniapp-runtime/dsl/common.js 在不同 module 闭包间
      // 共享 `var f` 等变量名，mangleExports 关闭后会保留原始 export 名。
      chain.optimization.set("mangleExports", false);
      chain.optimization.set("usedExports", false);
      chain.optimization.set("concatenateModules", false);
      chain.optimization.set("providedExports", false);
      chain.optimization.set("sideEffects", false);
    },
    postcss: {
      pxtransform: { enable: true },
      cssModules: { enable: false },
    },
  },
  h5: {},
  defineConstants: {
    "process.env.TARO_APP_API_BASE_URL": JSON.stringify(
      process.env.TARO_APP_API_BASE_URL ?? "",
    ),
    "process.env.TARO_APP_API_TOKEN": JSON.stringify(
      process.env.TARO_APP_API_TOKEN ?? "",
    ),
  },
};

export default defineConfig(config);
