import { Button, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { ChildProfile } from "../../models";
import { listChildren } from "../../services/family";
import { ChildPicker } from "../../components/ChildPicker";
import { LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";

export default function AssessmentStartPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [childId, setChildId] = useState("");
  const [loading, setLoading] = useState(true);

  useLoad(() => {
    void listChildren()
      .then((items) => {
        setChildren(items);
        setChildId(items[0]?.child_id ?? "");
      })
      .catch((error) => showError(error, "儿童档案加载失败。"))
      .finally(() => setLoading(false));
  });

  const start = () => {
    if (!childId) {
      void Taro.showToast({ title: "请先添加儿童档案", icon: "none" });
      return;
    }
    void Taro.navigateTo({ url: `/pages/assessment/input?childId=${childId}` });
  };

  if (loading)
    return (
      <View className="page">
        <LoadingState />
      </View>
    );

  return (
    <View className="page">
      <Text className="page-title">开始体测</Text>
      <Text className="page-subtitle">
        先选择孩子，再按现场实际完成的项目逐项录入。
      </Text>
      <View className="card">
        {children.length ? (
          <ChildPicker
            children={children}
            value={childId}
            onChange={setChildId}
          />
        ) : (
          <Text className="danger-note">
            还没有儿童档案，请先去“我的”添加。
          </Text>
        )}
        <Text className="muted">
          缺测项目不会自动按 0 分计算；幼儿园阶段使用参考模式，不生成国家总评。
        </Text>
        <Button className="primary-button" onClick={start}>
          进入体测录入
        </Button>
      </View>
      <View className="card">
        <Text className="section-title">现场准备</Text>
        <Text className="muted">
          准备合适的运动空间、测量工具和监护人陪同。录入前请以实际测量值为准。
        </Text>
      </View>
    </View>
  );
}
