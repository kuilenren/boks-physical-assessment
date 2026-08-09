import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 测试文件共享同一份 data/boks-store.json（JSON 存储模式）。
    // Windows 上并行 worker 同时对同一文件执行原子 rename 会触发 EPERM，
    // 因此将测试文件串行执行，避免并发写同一存储文件。
    fileParallelism: false,
  },
});
