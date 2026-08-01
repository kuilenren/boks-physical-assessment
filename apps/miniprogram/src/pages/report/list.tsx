import { Button, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { ChildProfile, ReportListItem } from "../../models";
import { listChildren } from "../../services/family";
import { listReports } from "../../services/assessment";
import { ErrorState, LoadingState } from "../../components/PageState";
import { formatDate } from "../../utils/format";

export default function ReportListPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const childItems = await listChildren();
      setChildren(childItems);
      const reportGroups = await Promise.all(
        childItems.map((child) => listReports(child.child_id, childItems)),
      );
      setReports(reportGroups.flat());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "报告加载失败。",
      );
    } finally {
      setLoading(false);
    }
  };

  useLoad(() => {
    void load();
  });

  if (loading)
    return (
      <View className="page">
        <LoadingState />
      </View>
    );
  if (error)
    return (
      <View className="page">
        <ErrorState message={error} onRetry={() => void load()} />
      </View>
    );

  return (
    <View className="page">
      <Text className="page-title">体测报告</Text>
      <Text className="page-subtitle">
        每份报告都标注标准版本、算法版本和适用限制。
      </Text>
      {children.length === 0 ? (
        <Text className="muted">还没有儿童档案。</Text>
      ) : null}
      <View className="card">
        {reports.length === 0 ? (
          <Text className="muted">还没有已生成报告。</Text>
        ) : null}
        {reports.map((report) => (
          <View className="list-row" key={report.report_id}>
            <View>
              <Text className="result-label">
                {formatDate(report.created_at)}
              </Text>
              <Text className="muted">
                {report.report_type === "reference_only"
                  ? "参考进步报告"
                  : "综合体测报告"}
              </Text>
            </View>
            <Button
              className="secondary-button"
              onClick={() =>
                void Taro.navigateTo({
                  url: `/pages/report/detail?reportId=${report.report_id}`,
                })
              }
            >
              查看
            </Button>
          </View>
        ))}
      </View>
    </View>
  );
}
