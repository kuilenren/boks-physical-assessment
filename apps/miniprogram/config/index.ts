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
    postcss: {
      pxtransform: {
        enable: true,
      },
      cssModules: {
        enable: false,
      },
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
