import { Button, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { ChildProfile, TrainingPlan } from "../../models";
import { listChildren } from "../../services/family";
import { createTrainingPlan, listTrainingPlans } from "../../services/training";
import { ChildPicker } from "../../components/ChildPicker";
import { ErrorState, LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";

export default function TrainingDetailPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [reportId, setReportId] = useState<string | undefined>();

  const load = async (preferredChildId?: string) => {
    setLoading(true);
    setError("");
    try {
      const [childItems, plans] = await Promise.all([
        listChildren(),
        listTrainingPlans(preferredChildId),
      ]);
      const selectedChildId = preferredChildId ?? childItems[0]?.child_id ?? "";
      setChildren(childItems);
      setChildId(selectedChildId);
      setPlan(
        plans.find((item) => item.child_id === selectedChildId) ??
          plans[0] ??
          null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "训练计划加载失败。",
      );
    } finally {
      setLoading(false);
    }
  };

  useLoad((params) => {
    setReportId(params?.reportId);
    void load(params?.childId);
  });

  const generate = async () => {
    if (!childId) {
      void Taro.showToast({ title: "请先添加儿童档案", icon: "none" });
      return;
    }
    setGenerating(true);
    try {
      setPlan(await createTrainingPlan(childId, reportId));
    } catch (generateError) {
      showError(generateError, "训练计划生成失败。");
    } finally {
      setGenerating(false);
    }
  };

  if (loading)
    return (
      <View className="page">
        <LoadingState />
      </View>
    );
  if (error)
    return (
      <View className="page">
        <ErrorState message={error} onRetry={() => void load(childId)} />
      </View>
    );

  return (
    <View className="page">
      <Text className="page-title">训练计划</Text>
      <Text className="page-subtitle">
        按孩子当前表现生成家庭可执行的训练建议。
      </Text>
      <View className="card">
        <ChildPicker
          children={children}
          value={childId}
          onChange={(nextChildId) => {
            setChildId(nextChildId);
            void load(nextChildId);
          }}
        />
        <Button
          className="primary-button"
          loading={generating}
          onClick={() => void generate()}
        >
          {plan ? "重新生成计划" : "生成训练计划"}
        </Button>
      </View>
      {plan ? (
        <>
          <View className="card">
            <Text className="section-title">{plan.title}</Text>
            <Text className="muted">
              {plan.duration_weeks} 周 · 每周 {plan.sessions_per_week} 次 ·
              每次约 {plan.session_minutes} 分钟
            </Text>
          </View>
          <View className="card">
            <Text className="section-title">本周安排</Text>
            {plan.weekly_schedule.map((session) => (
              <View className="training-row" key={session.day_label}>
                <View>
                  <Text className="result-label">
                    {session.day_label} · {session.focus}
                  </Text>
                  <Text className="muted">{session.exercises.join("、")}</Text>
                </View>
                <Text className="unit">{session.minutes} 分钟</Text>
              </View>
            ))}
          </View>
          <View className="card">
            <Text className="section-title">安全提醒</Text>
            {plan.safety_notes.map((note) => (
              <Text className="action-row" key={note}>
                {note}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <View className="card">
          <Text className="muted">还没有训练计划，点击上方按钮生成一份。</Text>
        </View>
      )}
    </View>
  );
}
