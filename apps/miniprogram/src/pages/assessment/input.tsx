import { Button, Input, Text, View } from "@tarojs/components";
import { redirectTo, showToast, useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { ChildProfile, AssessmentSchema } from "../../models";
import { ChildPicker } from "../../components/ChildPicker";
import { LoadingState } from "../../components/PageState";
import { listChildren } from "../../services/family";
import {
  createSession,
  getSchema,
  saveSession,
  submitSession,
} from "../../services/assessment";
import { showError } from "../../utils/error";
import {
  selectChild,
  setSelectedChildId,
} from "../../services/child-selection";

function initialValues(schema: AssessmentSchema): Record<string, string> {
  return Object.fromEntries(
    schema.indicators.map((indicator) => [indicator.indicator_code, ""]),
  );
}

export default function AssessmentInputPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [schema, setSchema] = useState<AssessmentSchema | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useLoad((params) => {
    const queryChildId = params?.childId;
    void listChildren()
      .then(async (childItems) => {
        setChildren(childItems);
        const selectedChildId = selectChild(childItems, queryChildId);
        setChildId(selectedChildId);
        if (!selectedChildId) return;
        const schemaValue = await getSchema(selectedChildId);
        setSchema(schemaValue);
        setValues(initialValues(schemaValue));
      })
      .catch((error) => showError(error, "体测项目加载失败。"))
      .finally(() => setLoading(false));
  });

  const setMetric = (metricCode: string, value: string) => {
    setValues((current) => ({ ...current, [metricCode]: value }));
  };

  const submit = async () => {
    if (!childId) {
      void showToast({ title: "请先选择孩子", icon: "none" });
      return;
    }

    if (!schema) {
      void showToast({ title: "体测项目尚未加载", icon: "none" });
      return;
    }

    const valuesToSubmit = schema.indicators
      .map((indicator) => ({
        indicator_code: indicator.indicator_code,
        raw_value: values[indicator.indicator_code] ?? "",
        unit: indicator.unit,
      }))
      .filter((metric) => metric.raw_value.trim().length > 0);

    if (valuesToSubmit.length === 0) {
      void showToast({ title: "至少录入一项实际测量值", icon: "none" });
      return;
    }

    setSubmitting(true);
    try {
      const session = sessionId || (await createSession(schema)).id;
      setSessionId(session);
      await saveSession(session, valuesToSubmit);
      const report = await submitSession(session, valuesToSubmit);
      void redirectTo({
        url: `/pages/report/detail?reportId=${report.report_id}`,
      });
    } catch (error) {
      showError(error, "体测提交失败。");
    } finally {
      setSubmitting(false);
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
      <View className="page-header">
        <Text className="page-kicker">MEASUREMENT ENTRY</Text>
        <Text className="page-title">录入体测数据</Text>
        <Text className="page-subtitle">
          空白项目代表缺测，不会静默当作 0 分。
        </Text>
      </View>
      <View className="card">
        <ChildPicker
          children={children}
          value={childId}
          onChange={(nextChildId) => {
            setChildId(nextChildId);
            setSelectedChildId(nextChildId);
            setSessionId("");
            void getSchema(nextChildId)
              .then((nextSchema) => {
                setSchema(nextSchema);
                setValues(initialValues(nextSchema));
              })
              .catch((error) => showError(error, "体测项目加载失败。"));
          }}
        />
      </View>
      <View className="card">
        <Text className="section-title">测量项目</Text>
        {schema?.indicators.map((indicator) => (
          <View key={indicator.indicator_code}>
            <View className="metric-heading">
              <Text className="field-label">{indicator.display_name}</Text>
              <Text className="unit">{indicator.unit}</Text>
            </View>
            <Input
              className="metric-input"
              type="digit"
              value={values[indicator.indicator_code]}
              placeholder={`请输入${indicator.display_name}`}
              onInput={(event) =>
                setMetric(indicator.indicator_code, event.detail.value)
              }
            />
            <Text className="muted">{indicator.description}</Text>
          </View>
        ))}
        <Button
          className="primary-button"
          loading={submitting}
          onClick={() => void submit()}
        >
          提交并生成报告
        </Button>
      </View>
      <Text className="muted">
        评分依据国家学生体质健康标准（2014 年修订）查表计算，结果仅作体能观察，不构成医疗建议或诊断。
      </Text>
    </View>
  );
}
