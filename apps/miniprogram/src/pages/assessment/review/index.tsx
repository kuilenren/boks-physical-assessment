import { Button, Text, View } from "@tarojs/components";
import { navigateBack, redirectTo, useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { AssessmentSession, ChildProfile } from "../../../models";
import { getSession, saveSession, submitSession } from "../../../services/assessment";
import { listChildren } from "../../../services/family";
import { ChildPicker } from "../../../components/ChildPicker";
import { ErrorState, LoadingState } from "../../../components/PageState";
import { showError } from "../../../utils/error";
import {
  selectChild,
  setSelectedChildId,
} from "../../../services/child-selection";

export default function AssessmentReviewPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useLoad((params) => {
    const sessionId = params?.sessionId;
    if (!sessionId) {
      void navigateBack();
      return;
    }
    void listChildren()
      .then((items) => {
        setChildren(items);
        setChildId(selectChild(items));
        return getSession(sessionId);
      })
      .then((s) => {
        setSession(s);
        const initialValues: Record<string, string> = {};
        for (const v of s.values) {
          initialValues[v.indicator_code] = v.raw_value;
        }
        setValues(initialValues);
      })
      .catch((error) => showError(error, "会话加载失败。"))
      .finally(() => setLoading(false));
  });

  const setMetric = (metricCode: string, value: string) => {
    setValues((current) => ({ ...current, [metricCode]: value }));
  };

  const save = async () => {
    if (!session) return;
    try {
      const updated = await saveSession(session.id, Object.entries(values).map(([indicator_code, raw_value]) => ({
        indicator_code,
        raw_value,
        unit: "",
      })));
      setSession(updated);
    } catch (error) {
      showError(error, "保存失败。");
    }
  };

  const submit = async () => {
    if (!session) return;
    const valuesToSubmit = Object.entries(values)
      .filter(([, raw_value]) => raw_value.trim().length > 0)
      .map(([indicator_code, raw_value]) => ({
        indicator_code,
        raw_value,
        unit: "",
      }));
    if (valuesToSubmit.length === 0) {
      void redirectTo({ url: "/pages/assessment/input" });
      return;
    }
    setSubmitting(true);
    try {
      const report = await submitSession(session.id, valuesToSubmit);
      void redirectTo({
        url: `/pages/report/detail?reportId=${report.report_id}`,
      });
    } catch (error) {
      showError(error, "体测提交失败。");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="page">
        <LoadingState />
      </View>
    );
  }

  if (!session) {
    return (
      <View className="page">
        <ErrorState message="会话不存在。" onRetry={() => void navigateBack()} />
      </View>
    );
  }

  return (
    <View className="page">
      <View className="page-header">
        <Text className="page-kicker">REVIEW DATA</Text>
        <Text className="page-title">复核体测数据</Text>
        <Text className="page-subtitle">
          检查录入值，确认无误后提交生成报告。
        </Text>
      </View>

      <View className="card">
        {children.length ? (
          <ChildPicker
            children={children}
            value={childId}
            onChange={(nextChildId) => {
              setChildId(nextChildId);
              setSelectedChildId(nextChildId);
            }}
          />
        ) : null}
      </View>

      <View className="card">
        <Text className="section-title">已录入项目</Text>
        {Object.entries(values).map(([code, value]) => (
          <View key={code}>
            <View className="metric-heading">
              <Text className="field-label">{code}</Text>
            </View>
            <View className="metric-input-row">
              <Text className="muted">
                {value || "（未录入）"}
              </Text>
            </View>
          </View>
        ))}
        {Object.keys(values).length === 0 ? (
          <Text className="muted">暂无录入数据，请返回录入页面。</Text>
        ) : null}
      </View>

      <View className="card">
        <Button className="secondary-button" onClick={() => void save()}>
          保存修改
        </Button>
        <Button
          className="primary-button"
          loading={submitting}
          onClick={() => void submit()}
        >
          提交并生成报告
        </Button>
      </View>
    </View>
  );
}
