import { Button, Text, View } from "@tarojs/components";
import {
  chooseImage,
  redirectTo,
  showModal,
  showToast,
  useLoad,
} from "@tarojs/taro";
import { useState } from "react";
import type { PostureSession, PostureView } from "../../models";
import {
  getPostureSession,
  submitPostureSession,
  uploadPostureView,
} from "../../services/posture";
import { LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";

const views: Array<{ key: PostureView["view"]; label: string; hint: string }> =
  [
    { key: "front", label: "正面", hint: "双脚自然分开，保持身体放松" },
    { key: "left", label: "左侧", hint: "身体侧向镜头，保持站立" },
    { key: "right", label: "右侧", hint: "身体侧向镜头，保持站立" },
    { key: "back", label: "背面", hint: "背对镜头，保持肩胯自然" },
  ];

export default function PostureCapturePage() {
  const [session, setSession] = useState<PostureSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);

  useLoad((params) => {
    const sessionId = params?.sessionId;
    if (!sessionId) {
      void showToast({ title: "缺少体态任务编号", icon: "none" });
      setLoading(false);
      return;
    }
    void getPostureSession(sessionId)
      .then((value) => {
        setSession(value);
        const firstMissing = views.findIndex(
          (item) =>
            !value.views.find((view) => view.view === item.key)?.asset_id,
        );
        setCurrentIndex(firstMissing >= 0 ? firstMissing : views.length - 1);
      })
      .catch((error) => showError(error, "体态任务加载失败。"))
      .finally(() => setLoading(false));
  });

  const current = views[currentIndex];
  const capture = async () => {
    if (!session || !current) return;
    setCapturing(true);
    try {
      const result = await chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType: ["camera", "album"],
      });
      const updated = await uploadPostureView(
        session.session_id,
        current.key,
        result.tempFilePaths[0],
      );
      setSession(updated);
      const nextIndex = views.findIndex(
        (item, index) =>
          index > currentIndex &&
          !updated.views.find((view) => view.view === item.key)?.asset_id,
      );
      if (nextIndex >= 0) setCurrentIndex(nextIndex);
      void showToast({
        title: result.tempFilePaths[0] ? "照片已上传" : "上传完成",
        icon: "success",
      });
    } catch (error) {
      showError(error, "拍摄或登记失败。");
    } finally {
      setCapturing(false);
    }
  };

  const submit = async () => {
    if (!session) return;
    setCapturing(true);
    try {
      const updated = await submitPostureSession(session.session_id);
      setSession(updated);
      const reportId = updated.analysis?.report_id;
      void showModal({
        title: "已完成拍摄",
        content:
          updated.quality_status === "ready_for_review"
            ? "四个视角质量检查通过，已生成非诊断性观察报告。"
            : "视角尚未完整，请补齐后再提交。",
        showCancel: false,
      }).then(() => {
        if (reportId) {
          void redirectTo({
            url: `/pages/posture/report?reportId=${reportId}`,
          });
        }
      });
    } catch (error) {
      showError(error, "提交体态任务失败。");
    } finally {
      setCapturing(false);
    }
  };

  if (loading)
    return (
      <View className="page">
        <LoadingState />
      </View>
    );
  if (!session || !current)
    return (
      <View className="page">
        <Text className="danger-note">体态任务不存在。</Text>
      </View>
    );

  const completed = session.views.filter((view) =>
    Boolean(view.asset_id),
  ).length;

  return (
    <View className="page">
      <Text className="page-title">四视角拍摄</Text>
      <Text className="page-subtitle">
        第 {currentIndex + 1} / {views.length} 个视角：{current.label}
      </Text>
      <View className="view-progress">
        {views.map((item) => (
          <Text
            className={`view-dot ${session.views.find((view) => view.view === item.key)?.asset_id ? "view-dot-done" : ""}`}
            key={item.key}
          >
            {item.label}
          </Text>
        ))}
      </View>
      <View className="capture-frame">
        <Text className="capture-outline">站立轮廓</Text>
        <Text className="section-title">{current.label}视角</Text>
        <Text className="muted">{current.hint}</Text>
      </View>
      <Button
        className="primary-button"
        loading={capturing}
        onClick={() => void capture()}
      >
        拍摄并登记{current.label}照片
      </Button>
      <Text className="muted capture-footnote">
        已登记 {completed} / {views.length}{" "}
        个视角。照片仅用于本次体态观察任务，上传后会进行安全校验。
      </Text>
      <Button
        className="secondary-button"
        loading={capturing}
        onClick={() => void submit()}
      >
        提交体态观察任务
      </Button>
    </View>
  );
}
