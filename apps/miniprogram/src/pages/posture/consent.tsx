import { Button, Checkbox, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { ChildProfile } from "../../models";
import { listChildren } from "../../services/family";
import { createPostureSession } from "../../services/posture";
import { ChildPicker } from "../../components/ChildPicker";
import { LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";
import {
  selectChild,
  setSelectedChildId,
} from "../../services/child-selection";

const CONSENT_VERSION = "posture-observation-v1";

export default function PostureConsentPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useLoad(() => {
    void listChildren()
      .then((items) => {
        setChildren(items);
        setChildId(selectChild(items));
      })
      .catch((error) => showError(error, "儿童档案加载失败。"))
      .finally(() => setLoading(false));
  });

  const start = async () => {
    if (!childId || !checked) {
      void Taro.showToast({
        title: "请选择孩子并完成监护人确认",
        icon: "none",
      });
      return;
    }
    setStarting(true);
    try {
      const session = await createPostureSession(childId, CONSENT_VERSION);
      void Taro.redirectTo({
        url: `/pages/posture/capture?sessionId=${session.session_id}`,
      });
    } catch (error) {
      showError(error, "授权记录失败。");
    } finally {
      setStarting(false);
    }
  };

  if (loading)
    return (
      <View className="page">
        <LoadingState />
      </View>
    );

  return (
    <View className="page">
      <Text className="page-title">体态观察</Text>
      <Text className="page-subtitle">拍摄前请由监护人阅读并确认用途。</Text>
      <View className="danger-note">
        这是非诊断性的姿态观察流程，不替代医生、影像检查或医疗诊断。照片质量不足时不会生成风险结论。
      </View>
      <View className="card">
        <ChildPicker
          children={children}
          value={childId}
          onChange={(nextChildId) => {
            setChildId(nextChildId);
            setSelectedChildId(nextChildId);
          }}
        />
      </View>
      <View className="card">
        <Text className="section-title">拍摄和数据用途</Text>
        <Text className="muted">
          照片只用于本次 BOKS 体态观察任务和报告生成，监护人可以在后续申请删除。
        </Text>
        <Text className="muted">
          请让孩子穿着贴身但舒适的服装，在光线均匀、背景简单的位置完成正面、左侧、右侧、背面拍摄。
        </Text>
      </View>
      <View className={`consent-checkbox ${checked ? "consent-checked" : ""}`}>
        <Checkbox
          value="consent"
          checked={checked}
          onClick={() => setChecked((current) => !current)}
        />
        <Text onClick={() => setChecked((current) => !current)}>
          我确认已阅读说明，并有权代表孩子作出本次授权。
        </Text>
      </View>
      <Button
        className="primary-button"
        loading={starting}
        onClick={() => void start()}
      >
        同意并开始拍摄
      </Button>
      <Text
        className="privacy-link"
        onClick={() => void Taro.navigateTo({ url: "/pages/privacy/index" })}
      >
        查看完整隐私说明
      </Text>
    </View>
  );
}
