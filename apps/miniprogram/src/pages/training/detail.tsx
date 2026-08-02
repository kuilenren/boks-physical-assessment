import { Button, Text, View } from "@tarojs/components";
import { showToast, useLoad } from "@tarojs/taro";
import { useState } from "react";
import type {
  ChildProfile,
  TrainingPlan,
  TrainingProgress,
} from "../../models";
import { listChildren } from "../../services/family";
import {
  checkInTraining,
  createTrainingPlan,
  getTrainingProgress,
  listTrainingPlans,
  pauseTraining,
  resumeTraining,
} from "../../services/training";
import { ChildPicker } from "../../components/ChildPicker";
import { IconBadge } from "../../components/Icon";
import { ErrorState, LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";
import {
  selectChild,
  setSelectedChildId,
} from "../../services/child-selection";
import { readTabParams } from "../../services/navigation";

export default function TrainingDetailPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [reportId, setReportId] = useState<string | undefined>();
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [workingDay, setWorkingDay] = useState<number | null>(null);

  const load = async (preferredChildId?: string) => {
    setLoading(true);
    setError("");
    try {
      const [childItems, plans] = await Promise.all([
        listChildren(),
        listTrainingPlans(preferredChildId),
      ]);
      const selectedChildId = selectChild(childItems, preferredChildId);
      setChildren(childItems);
      setChildId(selectedChildId);
      const selectedPlan =
        plans.find((item) => item.child_id === selectedChildId) ??
        plans[0] ??
        null;
      setPlan(selectedPlan);
      setProgress(
        selectedPlan ? await getTrainingProgress(selectedPlan.plan_id) : null,
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
    const tabParams = readTabParams()["/pages/training/detail"];
    const childIdParam = params?.childId ?? tabParams?.childId;
    const reportIdParam = params?.reportId ?? tabParams?.reportId;
    setReportId(reportIdParam);
    void load(childIdParam);
  });

  const generate = async () => {
    if (!childId) {
      void showToast({ title: "请先添加儿童档案", icon: "none" });
      return;
    }
    setGenerating(true);
    try {
      const nextPlan = await createTrainingPlan(childId, reportId);
      setPlan(nextPlan);
      setProgress(await getTrainingProgress(nextPlan.plan_id));
    } catch (generateError) {
      showError(generateError, "训练计划生成失败。");
    } finally {
      setGenerating(false);
    }
  };

  const checkIn = async (day: number) => {
    if (!plan) return;
    if (workingDay !== null) return;
    setWorkingDay(day);
    try {
      await checkInTraining(plan.plan_id, {
        day,
        status: "completed",
        note: null,
      });
      setProgress(await getTrainingProgress(plan.plan_id));
      void showToast({ title: "训练已打卡", icon: "success" });
    } catch (checkInError) {
      showError(checkInError, "训练打卡失败。");
    } finally {
      setWorkingDay(null);
    }
  };

  const togglePause = async () => {
    if (!plan) return;
    try {
      if (plan.status === "paused_safety_review") {
        const resumed = await resumeTraining(plan.plan_id);
        setPlan(resumed);
      } else {
        const paused = await pauseTraining(
          plan.plan_id,
          "监护人主动暂停，等待安全确认。",
        );
        setPlan({
          ...plan,
          status: paused.plan.status,
        });
      }
      setProgress(await getTrainingProgress(plan.plan_id));
    } catch (pauseError) {
      showError(pauseError, "训练状态更新失败。");
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
      <View className="page-header">
        <Text className="page-kicker">FAMILY TRAINING</Text>
        <Text className="page-title">训练计划</Text>
        <Text className="page-subtitle">
          按孩子当前表现生成家庭可执行的训练建议。
        </Text>
      </View>
      <View className="card">
        <View className="child-row" style={{ marginBottom: "8px" }}>
          <Text className="section-title" style={{ marginBottom: 0 }}>
            计划设置
          </Text>
          <IconBadge name="training" tone="brand" size={36} />
        </View>
        <ChildPicker
          children={children}
          value={childId}
          onChange={(nextChildId) => {
            setChildId(nextChildId);
            setSelectedChildId(nextChildId);
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
            <Text className="status-pill">
              {plan.status === "paused_safety_review"
                ? "已暂停安全复核"
                : "进行中"}
            </Text>
            {progress ? (
              <Text className="muted">
                已完成 {progress.completed} 次 · 跳过 {progress.skipped} 次 · 共{" "}
                {progress.total_days} 次
              </Text>
            ) : null}
            <Button
              className="secondary-button"
              onClick={() => void togglePause()}
            >
              {plan.status === "paused_safety_review"
                ? "监护人确认后恢复"
                : "暂停训练"}
            </Button>
          </View>
          <View className="card">
            <Text className="section-title">每周安排</Text>
            {Array.from({ length: plan.duration_weeks }, (_, weekIndex) => {
              const week = weekIndex + 1;
              const sessions = plan.weekly_schedule.filter(
                (session) => session.week === week,
              );
              return (
                <View key={week}>
                  <Text className="muted" style={{ margin: "12px 0 4px" }}>
                    第 {week} 周
                  </Text>
                  {sessions.map((session) => (
                    <View
                      className="training-row"
                      key={`${session.week}-${session.day}`}
                    >
                      <View>
                        <Text className="result-label">
                          {session.day_label} · {session.focus}
                        </Text>
                        <Text className="muted">
                          {session.exercises.join("、")}
                        </Text>
                      </View>
                      <View>
                        <Text className="unit">{session.minutes} 分钟</Text>
                        <Button
                          className="secondary-button"
                          loading={workingDay === session.day}
                          onClick={() => void checkIn(session.day)}
                        >
                          打卡
                        </Button>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
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
