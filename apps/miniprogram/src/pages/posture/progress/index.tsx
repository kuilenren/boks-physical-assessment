import { Button, Text, View } from "@tarojs/components";
import { navigateBack, redirectTo, useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { PostureSession } from "../../../models";
import { getPostureSession } from "../../../services/posture";
import { ErrorState, LoadingState } from "../../../components/PageState";
import { showError } from "../../../utils/error";

const views: Array<{ key: "front" | "back" | "left" | "right"; label: string }> = [
  { key: "front", label: "正面" },
  { key: "back", label: "背面" },
  { key: "left", label: "左侧" },
  { key: "right", label: "右侧" },
];

export default function PostureProgressPage() {
  const [session, setSession] = useState<PostureSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useLoad((params) => {
    const sessionId = params?.sessionId;
    if (!sessionId) {
      setError("缺少体态任务编号。");
      setLoading(false);
      return;
    }
    void getPostureSession(sessionId)
      .then((value) => {
        setSession(value);
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error ? loadError.message : "体态任务加载失败。",
        ),
      )
      .finally(() => setLoading(false));
  });

  if (loading) {
    return (
      <View className="page">
        <LoadingState />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View className="page">
        <ErrorState
          message={error || "体态任务不存在。"}
          onRetry={() => void navigateBack()}
        />
      </View>
    );
  }

  const captured = session.views.filter((v) => Boolean(v.asset_id)).length;
  const total = views.length;
  const isReady = session.quality_status === "ready_for_review";
  const isNeedsRetake = session.quality_status === "needs_retake";

  return (
    <View className="page">
      <View className="page-header">
        <Text className="page-kicker">POSTURE PROGRESS</Text>
        <Text className="page-title">体态观察进度</Text>
        <Text className="page-subtitle">
          已拍摄 {captured} / {total} 个视角
        </Text>
      </View>

      <View className="card">
        <Text className="section-title">拍摄状态</Text>
        {views.map((item) => {
          const view = session.views.find((v) => v.view === item.key);
          const hasPhoto = Boolean(view?.asset_id);
          return (
            <View className="list-row" key={item.key}>
              <Text className="result-label">{item.label}</Text>
              <Text className={hasPhoto ? "status-pill" : "muted"}>
                {hasPhoto ? "已拍摄" : "未拍摄"}
              </Text>
            </View>
          );
        })}
      </View>

      {session.analysis ? (
        <View className="card">
          <Text className="section-title">观察状态</Text>
          <Text className="muted">
            置信度：{session.analysis.confidence === "high" ? "高" : session.analysis.confidence === "medium" ? "中" : "低"}
          </Text>
          <Text className="muted">
            观察结果：{session.analysis.observation_status === "observed" ? "已观察" : "数据不足"}
          </Text>
        </View>
      ) : null}

      {isNeedsRetake ? (
        <View className="card danger-note">
          <Text>照片质量未达标，请重新拍摄后再次提交。</Text>
        </View>
      ) : null}

      <View className="card">
        <Button
          className="primary-button"
          onClick={() => {
            if (session.session_id) {
              void redirectTo({
                url: `/pages/posture/capture?sessionId=${session.session_id}`,
              });
            }
          }}
        >
          继续拍摄
        </Button>
        {isReady ? (
          <Button
            className="secondary-button"
            onClick={() => {
              const reportId = session.analysis?.report_id;
              if (reportId) {
                void redirectTo({
                  url: `/pages/posture/report?reportId=${reportId}`,
                });
              }
            }}
          >
            查看观察报告
          </Button>
        ) : null}
      </View>
    </View>
  );
}
