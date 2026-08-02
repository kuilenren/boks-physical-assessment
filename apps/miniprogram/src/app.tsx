import { PropsWithChildren, useEffect } from "react";
import Taro from "@tarojs/taro";
import "./app.scss";

function registerPrivacyPrompt() {
  if (typeof Taro.onNeedPrivacyAuthorization !== "function") return;
  Taro.onNeedPrivacyAuthorization((resolve) => {
    resolve({ event: "exposureAuthorization" });
    void Taro.showModal({
      title: "需要监护人确认",
      content: "拍摄和上传照片前，需要先阅读并同意 BOKS 隐私说明。",
      confirmText: "同意并继续",
      cancelText: "暂不同意",
      showCancel: true,
    }).then(({ confirm }) => {
      resolve({ event: confirm ? "agree" : "disagree" });
    });
  });
}

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    registerPrivacyPrompt();
  }, []);

  return children;
}

export default App;
