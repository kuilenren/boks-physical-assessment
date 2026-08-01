import { Button, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { FamilySummary } from "../../models";
import { getFamilySummary } from "../../services/family";
import { ErrorState, LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";

function open(path: string) {
  void Taro.navigateTo({ url: path });
}

export default function HomePage() {
  const [summary, setSummary] = useState<FamilySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setSummary(await getFamilySummary());
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

  const child = summary.children[0];

  return (
    <View className="page">
      <Text className="page-title">你好，BOKS 家庭</Text>
      <Text className="page-subtitle">
        记录成长，用科学训练陪伴孩子变得更强健。
      </Text>

      <View className="card">
        <Text className="section-title">本周概览</Text>
        <Text className="muted">
          {child
            ? `已为 ${child.display_name} 建立成长档案`
            : "先添加孩子档案，再开始第一次体测"}
        </Text>
        <Text className="status-pill">
          {summary.pending_actions > 0
            ? `${summary.pending_actions} 项待完成`
            : "本周暂无待办"}
        </Text>
      </View>

      <View className="entry-grid">
        <View
          className="entry-card"
          onClick={() => open("/pages/assessment/start")}
        >
          <Text className="entry-icon">▥</Text>
          <Text className="entry-title">开始体测</Text>
          <Text className="muted">录入动态项目并生成报告</Text>
        </View>
        <View
          className="entry-card"
          onClick={() => open("/pages/posture/consent")}
        >
          <Text className="entry-icon">◎</Text>
          <Text className="entry-title">体态观察</Text>
          <Text className="muted">授权后完成四视角拍摄</Text>
        </View>
      </View>

      <View className="card">
        <Text className="section-title">快捷入口</Text>
        <Button
          className="action-row"
          onClick={() => open("/pages/report/list")}
        >
          查看体测报告
        </Button>
        <Button
          className="action-row"
          onClick={() => open("/pages/training/detail")}
        >
          查看训练计划
        </Button>
        <Button
          className="action-row"
          onClick={() => open("/pages/family/index")}
        >
          管理儿童档案
        </Button>
      </View>

      <Text
        className="privacy-link"
        onClick={() => open("/pages/privacy/index")}
      >
        隐私与数据说明
      </Text>
      <Button
        className="secondary-button"
        onClick={() => {
          void Taro.showToast({
            title: "当前为开发演示环境",
            icon: "none",
          }).catch(showError);
        }}
      >
        开发环境说明
      </Button>
    </View>
  );
}
