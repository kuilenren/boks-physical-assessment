import Taro from "@tarojs/taro";

export function showError(error: unknown, fallback = "操作失败，请稍后重试。") {
  const message = error instanceof Error ? error.message : fallback;
  void Taro.showToast({
    title: message.length > 20 ? `${message.slice(0, 19)}…` : message,
    icon: "none",
  });
}
