import { Text, View } from "@tarojs/components";
import { useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { AssessmentReport, ChildProfile } from "../../models";
import { listReports } from "../../services/assessment";
import { listChildren } from "../../services/family";
import { ChildPicker } from "../../components/ChildPicker";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/PageState";
import { IconBadge } from "../../components/Icon";
import {
  selectChild,
  setSelectedChildId,
} from "../../services/child-selection";
import { formatDate } from "../../utils/format";
import { openRoute } from "../../services/navigation";

export default function ReportListPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [reports, setReports] = useState<AssessmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async (
    nextChildId: string,
    nextChildren: ChildProfile[],
  ) => {
    if (!nextChildId) {
      setReports([]);
      return;
    }
    setReports(await listReports(nextChildId, nextChildren));
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const nextChildren = await listChildren();
      const nextChildId = selectChild(nextChildren);
      setChildren(nextChildren);
      setChildId(nextChildId);
      await loadReports(nextChildId, nextChildren);
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

  const onChildChange = async (nextChildId: string) => {
    setChildId(nextChildId);
    setSelectedChildId(nextChildId);
    setLoading(true);
    setError("");
    try {
      await loadReports(nextChildId, children);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "报告加载失败。",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="page">
      <View className="page-header">
        <Text className="page-kicker">REPORT CENTER</Text>
        <Text className="page-title">体测报告</Text>
        <Text className="page-subtitle">
          查看评分摘要、短板建议和后续训练入口。
        </Text>
      </View>

      {children.length ? (
        <View className="card">
          <ChildPicker
            children={children}
            value={childId}
            onChange={(next) => void onChildChange(next)}
          />
        </View>
      ) : null}

      {loading ? <LoadingState /> : null}
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && reports.length === 0 ? (
        <EmptyState
          title="还没有体测报告"
          message="完成一次体测录入后，这里会显示报告摘要。"
          actionLabel="去体测"
          onAction={() => openRoute("/pages/assessment/start")}
        />
      ) : null}

      {!loading && !error
        ? reports.map((report) => (
            <View
              className="card list-card"
              key={report.report_id}
              onClick={() =>
                openRoute("/pages/report/detail", {
                  reportId: report.report_id,
                })
              }
            >
              <View className="child-row">
                <View>
                  <Text
                    className="section-title"
                    style={{ marginBottom: "4px" }}
                  >
                    {report.grade_label || "体测报告"}
                  </Text>
                  <Text className="muted">
                    {formatDate(report.created_at)} · {report.assessment_date}
                  </Text>
                </View>
                <IconBadge name="report" tone="brand" size={36} />
              </View>
              <Text className="muted">
                总分 {report.overall_score ?? "--"} · 点击查看详情
              </Text>
            </View>
          ))
        : null}
    </View>
  );
}
