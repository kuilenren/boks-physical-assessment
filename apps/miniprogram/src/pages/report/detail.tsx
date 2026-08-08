import { Button, Text, View } from "@tarojs/components";
import { navigateBack, useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { AssessmentReport } from "../../models";
import { getAssessmentTrend, getReport } from "../../services/assessment";
import { ErrorState, LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";
import { openRoute } from "../../services/navigation";

export default function ReportDetailPage() {
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trend, setTrend] = useState<
    Array<{
      report_id: string;
      measurement_date: string;
      total_score: number | null;
    }>
  >([]);

  useLoad((params) => {
    const reportId = params?.reportId;
    if (!reportId) {
      setError("缺少报告编号。");
      setLoading(false);
      return;
    }
    void getReport(reportId)
      .then(async (value) => {
        setReport(value);
        const trendValue = await getAssessmentTrend(value.child_id);
        setTrend(trendValue.points);
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error ? loadError.message : "报告加载失败。",
        ),
      )
      .finally(() => setLoading(false));
  });

  if (loading)
    return (
      <View className="page">
        <LoadingState />
      </View>
    );
  if (error || !report)
    return (
      <View className="page">
        <ErrorState
          message={error || "报告不存在。"}
          onRetry={() => void navigateBack()}
        />
      </View>
    );

  const isReference = report.report_type === "reference_only";

  return (
    <View className="page">
      <View className="page-header">
        <Text className="page-kicker">ASSESSMENT REPORT</Text>
        <Text className="page-title">体测评分报告</Text>
        <Text className="page-subtitle">
          {report.child_name} · {report.assessment_date}
        </Text>
      </View>
      {isReference ? (
        <View className="danger-note">
          幼儿阶段使用参考进步模式，不套用小学及以上国家总评等级。报告仅用于家庭训练沟通。
        </View>
      ) : null}
      <View className="score-card">
        <Text className="score-label">
          {isReference ? "参考进步分" : "综合评分"}
        </Text>
        <Text className="score-value">{report.overall_score ?? "—"}</Text>
        <Text className="score-caption">
          {report.grade_label ?? "缺少足够项目，暂不生成总评"}
        </Text>
      </View>
      <View className="card">
        <Text className="section-title">项目结果</Text>
        {report.results.map((result) => (
          <View className="result-row" key={result.indicator_code}>
            <View>
              <Text className="result-label">{result.display_name}</Text>
              <Text className="muted">
                {result.raw_value || "未录入"} {result.unit}
              </Text>
            </View>
            <View className="result-score">
              <Text className="result-label">
                {result.score ?? "未评分"} {result.score !== null ? "分" : ""}
              </Text>
              <Text className="muted">{result.status_label}</Text>
            </View>
          </View>
        ))}
      </View>
      <View className="card">
        <Text className="section-title">训练建议</Text>
        {report.training_summary.map((item) => (
          <Text className="action-row" key={item}>
            {item}
          </Text>
        ))}
        <Button
          className="primary-button"
          onClick={() => {
            openRoute("/pages/training/detail", {
              childId: report.child_id,
              reportId: report.report_id,
            });
          }}
        >
          查看训练计划
        </Button>
      </View>
      <View className="card">
        <Text className="section-title">报告依据</Text>
        <Text className="muted">标准版本：{report.standard_version}</Text>
        <Text className="muted">算法版本：{report.algorithm_version}</Text>
        <Text className="muted">知识快照：{report.knowledge_snapshot_id}</Text>
        <Text className="muted limitation">{report.limitation_text}</Text>
      </View>
      <View className="card">
        <Text className="section-title">历史趋势</Text>
        {trend.length === 0 ? (
          <Text className="muted">完成更多次体测后，这里会显示变化趋势。</Text>
        ) : (
          trend.map((point) => (
            <View className="list-row" key={point.report_id}>
              <Text className="muted">{point.measurement_date}</Text>
              <Text className="result-label">
                {point.total_score === null
                  ? "参考记录"
                  : `${point.total_score} 分`}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
