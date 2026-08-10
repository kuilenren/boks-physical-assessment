import { PropsWithChildren, useEffect } from "react";
import "./app.scss";

/**
 * 注册小程序隐私协议弹窗。
 * 仅在支持 onNeedPrivacyAuthorization 的基础库（≥ 3.7.0）中启用。
 * 旧版基础库或非 weapp 环境直接跳过，避免运行时报错。
 */
function tryRegisterPrivacyPrompt() {
  // 延迟加载避免在不支持的环境下 require 失败
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const taro = require("@tarojs/taro");
    if (typeof taro.onNeedPrivacyAuthorization !== "function") return;
    if (typeof taro.showModal !== "function") return;
    taro.onNeedPrivacyAuthorization(
      (resolve: (v: { event: string }) => void) => {
        resolve({ event: "exposureAuthorization" });
        taro
          .showModal({
            title: "需要监护人确认",
            content: "拍摄和上传照片前，需要先阅读并同意 BOKS 隐私说明。",
            confirmText: "同意并继续",
            cancelText: "暂不同意",
            showCancel: true,
          })
          .then((res: { confirm: boolean }) => {
            resolve({ event: res.confirm ? "agree" : "disagree" });
          })
          .catch(() => {
            resolve({ event: "disagree" });
          });
      },
    );
  } catch {
    // ignore：未安装或基础库不兼容
  }
}

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    tryRegisterPrivacyPrompt();
  }, []);

  return children;
}

export default App;
