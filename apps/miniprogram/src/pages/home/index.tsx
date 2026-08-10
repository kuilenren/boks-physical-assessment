import { Button, Text, View } from "@tarojs/components";
import { showToast, useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import type {
  AssessmentReport,
  FamilySummary,
  NextAction,
  TrainingPlan,
  TrainingProgress,
} from "../../models";
import { getFamilySummary, getNextActions } from "../../services/family";
import { listReports } from "../../services/assessment";
import {
  getTrainingProgress,
  listTrainingPlans,
} from "../../services/training";
import {
  selectChild,
  setSelectedChildId,
} from "../../services/child-selection";
import { ChildPicker } from "../../components/ChildPicker";
import { Icon, IconBadge } from "../../components/Icon";
import { ErrorState, LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";
import { openRoute } from "../../services/navigation";

function open(target: string) {
  const separator = target.indexOf("?");
  const path = separator < 0 ? target : target.slice(0, separator);
  const query = separator < 0 ? "" : target.slice(separator + 1);
  openRoute(path, {}, query);
}

function latestReportOf(reports: AssessmentReport[]) {
  return [...reports].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  )[0];
}

const actionTarget: Record<NextAction["category"], string> = {
  consent: "/pages/privacy/index",
  assessment: "/pages/assessment/start",
  training: "/pages/training/detail",
  posture: "/pages/posture/consent",
  consult: "/pages/chat/index",
};

export default function HomePage() {
  const [summary, setSummary] = useState<FamilySummary | null>(null);
  const [selectedChildId, setSelectedChildIdState] = useState("");
  const [latestReport, setLatestReport] = useState<AssessmentReport | null>(
    null,
  );
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [insightError, setInsightError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    setInsightError("");
    try {
      const nextSummary = await getFamilySummary();
      const nextChildId = selectChild(nextSummary.children);
      setSummary(nextSummary);
      setSelectedChildIdState(nextChildId);
      setLatestReport(null);
      setPlan(null);
      setProgress(null);

      if (!nextChildId) return;

      try {
        const [reports, plans, nextActionsResult] = await Promise.all([
          listReports(nextChildId, nextSummary.children),
          listTrainingPlans(nextChildId),
          getNextActions().catch(() => null),
        ]);
        const nextReport = latestReportOf(reports);
        const nextPlan = plans[0] ?? null;
        setLatestReport(nextReport ?? null);
        setPlan(nextPlan);
        setProgress(
          nextPlan ? await getTrainingProgress(nextPlan.plan_id) : null,
        );
        setNextActions(
          (nextActionsResult?.actions ?? []).filter(
            (item) => item.child_id === nextChildId,
          ),
        );
      } catch (insightLoadError) {
        setInsightError(
          insightLoadError instanceof Error
            ? insightLoadError.message
            : "报告和训练信息暂时不可用。",
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "家庭信息加载失败。",
      );
    } finally {
      setLoading(false);
    }
  };

  useLoad(() => {
    void load();
  });
  useDidShow(() => {
    void load();
  });

  if (loading) {
    return (
      <View className="page">
        <LoadingState />
      </View>
    );
  }

  if (error || !summary) {
    return (
      <View className="page">
        <ErrorState
          message={error || "家庭信息为空。"}
          onRetry={() => void load()}
        />
      </View>
    );
  }

  const child =
    summary.children.find((item) => item.child_id === selectedChildId) ??
    summary.children[0];
  const firstTraining = plan?.weekly_schedule[0];
  const completedDays = progress?.completed ?? 0;
  const totalDays = Math.max(progress?.total_days ?? 0, 1);
  const progressPercent = Math.min(
    100,
    Math.round((completedDays / totalDays) * 100),
  );

  return (
    <View className="page home-page">
      <View className="home-hero">
        <View className="home-hero-top">
          <View className="brand-lockup">
            <View className="brand-monogram">B</View>
            <View>
              <Text className="hero-eyebrow">BOKS FAMILY</Text>
              <Text className="hero-title">智能体测 · 体态观察</Text>
            </View>
          </View>
          <Text
            className={`privacy-status ${
              summary.children.length > 0
                ? "privacy-status-safe"
                : "privacy-status-pending"
            }`}
            onClick={() => open("/pages/privacy/index")}
          >
            <Icon
              name="shield"
              size={12}
              tone={summary.children.length > 0 ? "white" : "amber"}
            />
            {summary.children.length > 0 ? "监护人已就绪" : "先建立档案"}
          </Text>
        </View>

        <View className="home-profile">
          <Text className="hero-child-name">
            {child?.display_name ?? "添加孩子档案"}
          </Text>
          <Text className="hero-child-meta">
            {child
              ? `${child.grade_stage} · 仅供 BOKS 家庭使用`
              : "建立档案后开始记录成长变化"}
          </Text>
          {summary.children.length > 0 ? (
            <View className="home-child-picker">
              <ChildPicker
                children={summary.children}
                value={child?.child_id ?? ""}
                onChange={(nextChildId) => {
                  setSelectedChildIdState(nextChildId);
                  setSelectedChildId(nextChildId);
                  void load();
                }}
              />
            </View>
          ) : (
            <Button
              className="secondary-button"
              style={{ marginTop: "16px" }}
              onClick={() => open("/pages/family/index")}
            >
              去添加儿童档案
            </Button>
          )}
        </View>
      </View>

      {insightError ? (
        <View className="danger-note">
          <Icon name="alert" size={16} tone="danger" />
          <Text>{insightError} 可先继续录入体测或查看已有家庭档案。</Text>
        </View>
      ) : null}

      <View className="section-head">
        <Text className="section-title">最近一次体测</Text>
        <Text
          className="section-link"
          onClick={() => open("/pages/report/list")}
        >
          全部记录
        </Text>
      </View>

      <View className="insight-card">
        <View className="insight-head">
          <View className="insight-heading">
            <IconBadge name="report" tone="brand" size={42} />
            <View>
              <Text className="insight-title">
                {latestReport ? "国家标准体测报告" : "还没有体测记录"}
              </Text>
              <Text className="insight-date">
                {latestReport
                  ? `${latestReport.assessment_date} · ${latestReport.standard_name}`
                  : "完成一次真实测量后，这里会显示结果"}
              </Text>
            </View>
          </View>
          <View className="insight-score">
            <Text className="insight-score-number">
              {latestReport?.overall_score ?? "—"}
            </Text>
            {latestReport?.overall_score !== null &&
            latestReport?.overall_score !== undefined ? (
              <Text className="insight-score-unit">分</Text>
            ) : null}
            <Text className="insight-grade">
              {latestReport?.grade_label ?? "待完成"}
            </Text>
          </View>
        </View>

        {latestReport ? (
          <>
            <View className="insight-breakdown">
              <View className="insight-breakdown-item">
                <Text className="insight-breakdown-label">标准版本</Text>
                <Text className="insight-breakdown-value">
                  {latestReport.standard_version}
                </Text>
              </View>
              <View className="insight-breakdown-item">
                <Text className="insight-breakdown-label">报告状态</Text>
                <Text className="insight-breakdown-value">
                  {latestReport.standard_status === "approved"
                    ? "已审核标准"
                    : "参考模式"}
                </Text>
              </View>
            </View>
            <Text className="insight-action-title">优先改善行动</Text>
            {latestReport.training_summary.slice(0, 3).map((item) => (
              <View className="insight-action" key={item}>
                <Icon name="check" size={14} tone="brand" />
                <Text>{item}</Text>
              </View>
            ))}
            <Button
              className="primary-button insight-button"
              onClick={() =>
                open(`/pages/report/detail?reportId=${latestReport.report_id}`)
              }
            >
              查看完整报告
            </Button>
          </>
        ) : (
          <>
            <Text className="empty-insight">
              体测数据会按孩子的学段和已发布标准计算；缺测项目不会静默当作 0
              分。
            </Text>
            <Button
              className="primary-button insight-button"
              onClick={() => open("/pages/assessment/start")}
            >
              开始第一次体测
            </Button>
          </>
        )}
      </View>

      <View className="section-head">
        <Text className="section-title">下一步怎么做</Text>
        <Text className="section-link">两项核心记录</Text>
      </View>

      <View className="entry-grid">
        <View
          className="entry-card"
          onClick={() => open("/pages/assessment/start")}
        >
          <IconBadge name="assessment" tone="brand" size={44} />
          <Text className="entry-title">国家标准体测</Text>
          <Text className="entry-copy">按现场数据逐项录入，生成可追溯报告</Text>
          <Text className="entry-link">
            进入录入
            <Icon name="arrow" size={14} tone="brand" />
          </Text>
        </View>
        <View
          className="entry-card entry-card-posture"
          onClick={() => open("/pages/posture/consent")}
        >
          <IconBadge name="posture" tone="sky" size={44} />
          <Text className="entry-title">四视角体态观察</Text>
          <Text className="entry-copy">正、背、左、右视角，先授权再拍摄</Text>
          <Text className="entry-link">
            进入拍摄
            <Icon name="arrow" size={14} />
          </Text>
        </View>
      </View>

      {nextActions.length > 0 ? (
        <View className="section-head">
          <Text className="section-title">建议优先完成</Text>
          <Text className="section-link">按当前数据自动生成</Text>
        </View>
      ) : null}
      {nextActions.slice(0, 3).map((action) => (
        <View
          className="next-action"
          key={action.id}
          onClick={() => open(actionTarget[action.category])}
        >
          <View className="next-action-head">
            <Text className="next-action-title">{action.title}</Text>
            <Text className="next-action-reason">{action.reason}</Text>
          </View>
          <Text className="next-action-description">{action.description}</Text>
        </View>
      ))}

      <View className="home-training">
        <View className="home-training-head">
          <IconBadge name="training" tone="amber" size={42} />
          <View className="training-head-copy">
            <Text className="training-title">家庭训练计划</Text>
            <Text className="training-meta">
              {plan
                ? `${plan.duration_weeks} 周 · 每周 ${plan.sessions_per_week} 次 · 每次约 ${plan.session_minutes} 分钟`
                : "根据体测结果生成可执行的家庭计划"}
            </Text>
          </View>
          {plan ? (
            <Text className="training-progress-label">
              已完成 {completedDays} 次
            </Text>
          ) : null}
        </View>

        {plan ? (
          <>
            <View className="training-bar">
              <View
                className="training-bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </View>
            <View className="training-item">
              <View className="training-item-copy">
                <Text className="training-item-title">
                  {firstTraining?.focus ?? "综合训练"}
                </Text>
                <Text className="training-item-description">
                  {firstTraining
                    ? `${firstTraining.exercises.join("、")} · 约 ${firstTraining.minutes} 分钟`
                    : "打开训练页查看本周安排"}
                </Text>
              </View>
              <Text
                className="training-cta"
                onClick={() => open("/pages/training/detail")}
              >
                开始训练
              </Text>
            </View>
          </>
        ) : (
          <Text className="empty-insight">
            完成体测后，BOKS
            会根据当前数据生成训练建议；训练过程中可以随时暂停安全复核。
          </Text>
        )}
      </View>

      <View className="home-safety">
        <IconBadge name="alert" tone="amber" size={34} />
        <Text>
          BOKS
          提供体测评分与非诊断性体态观察。若孩子出现明显疼痛、麻木、无力或急症，请停止训练并及时就医。
        </Text>
      </View>

      <View className="home-footer">
        <Text
          className="home-footer-link"
          onClick={() => open("/pages/chat/index")}
        >
          专业咨询
        </Text>
        <Text className="home-footer-link">·</Text>
        <Text
          className="home-footer-link"
          onClick={() => open("/pages/privacy/index")}
        >
          隐私与数据说明
        </Text>
        <Text className="home-footer-link">·</Text>
        <Text
          className="home-footer-link"
          onClick={() => {
            void showToast({
              title: "BOKS 家庭成长记录",
              icon: "none",
            }).catch(showError);
          }}
        >
          关于 BOKS
        </Text>
      </View>
    </View>
  );
}
