import { Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { PostureReport } from "../../models";
import { getPostureReport } from "../../services/posture";
import { ErrorState, LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";

export default function PostureReportPage() {
  const [report, setReport] = useState<PostureReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useLoad((params) => {
    const reportId = params?.reportId;
    if (!reportId) {
      setError("缺少体态报告编号。");
      setLoading(false);
      return;
    }
    void getPostureReport(reportId)
      .then(setReport)
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : "体态报告加载失败。",
        );
      })
      .finally(() => setLoading(false));
  });

  if (loading) {
    return (
      <View className="page">
        <LoadingState />
      </View>
    );
  }
  if (error || !report) {
    return (
      <View className="page">
        <ErrorState
          message={error || "体态报告不存在。"}
          onRetry={() => void Taro.navigateBack()}
        />
      </View>
    );
  }

  return (
    <View className="page">
      <Text className="page-title">体态观察报告</Text>
      <Text className="page-subtitle">
        {report.generated_at.slice(0, 10)} · 非诊断性观察
      </Text>
      <View className="danger-note">
        普通照片不能诊断疾病，也不能测量 Cobb
        角。当前报告明确标记了数据不足和模型限制。
      </View>
      <View className="score-card">
        <Text className="score-label">当前能力</Text>
        <Text className="score-value">未分级</Text>
        <Text className="score-caption">
          当前仅完成照片任务质量检查，不输出姿态风险等级。
        </Text>
      </View>
      <View className="card">
        <Text className="section-title">观察结果</Text>
        {report.observations.map((item) => (
          <Text className="action-row" key={item}>
            {item}
          </Text>
        ))}
      </View>
      <View className="card">
        <Text className="section-title">建议</Text>
        {report.recommendations.map((item) => (
          <Text className="action-row" key={item}>
            {item}
          </Text>
        ))}
      </View>
      <View className="card">
        <Text className="section-title">限制说明</Text>
        {report.limitations.map((item) => (
          <Text className="muted limitation" key={item}>
            {item}
          </Text>
        ))}
      </View>
    </View>
  );
}
