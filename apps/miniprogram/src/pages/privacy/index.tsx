import { Button, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { ChildProfile } from "../../models";
import {
  exportFamily,
  listChildren,
  requestChildDeletion,
} from "../../services/family";
import { LoadingState } from "../../components/PageState";
import { showError } from "../../utils/error";

export default function PrivacyPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useLoad(() => {
    void listChildren()
      .then(setChildren)
      .catch((error) => showError(error, "数据控制信息加载失败。"))
      .finally(() => setLoading(false));
  });

  const exportData = async () => {
    try {
      const result = await exportFamily();
      await Taro.setClipboardData({ data: JSON.stringify(result, null, 2) });
      void Taro.showToast({ title: "数据已复制，可保存备份", icon: "success" });
    } catch (error) {
      showError(error, "数据导出失败。");
    }
  };

  const requestDeletion = async (child: ChildProfile) => {
    const confirmation = await Taro.showModal({
      title: "申请删除儿童数据",
      content: `将为${child.display_name}提交删除申请，报告、训练和体态任务会进入清理流程。`,
      confirmText: "提交申请",
    });
    if (!confirmation.confirm) return;
    try {
      await requestChildDeletion(child.child_id);
      void Taro.showToast({ title: "删除申请已提交", icon: "success" });
    } catch (error) {
      showError(error, "删除申请提交失败。");
    }
  };

  if (loading) {
    return (
      <View className="page">
        <LoadingState />
      </View>
    );
  }

  return (
    <View className="page">
      <Text className="page-title">隐私与数据说明</Text>
      <Text className="page-subtitle">BOKS 自有学生和家长专用</Text>
      <View className="card">
        <Text className="section-title">我们收集什么</Text>
        <Text className="muted">
          儿童档案、监护人主动录入的体测数据，以及监护人明确授权后的体态照片任务信息。
        </Text>
      </View>
      <View className="card">
        <Text className="section-title">如何使用</Text>
        <Text className="muted">
          数据用于生成体测报告、家庭训练建议和体态拍摄任务状态，不用于医疗诊断、学校排名或对外售卖。
        </Text>
      </View>
      <View className="card">
        <Text className="section-title">家长控制</Text>
        <Text className="muted">
          监护人可以在 BOKS
          运营流程中申请查看、修正或删除相关数据。照片质量不满足要求时不生成风险结论。
        </Text>
      </View>
      <View className="card">
        <Text className="section-title">重要限制</Text>
        <Text className="muted">
          开发环境中的评分为演示夹具。正式上线前，标准知识库、算法版本和数据存储策略必须完成审核发布。
        </Text>
      </View>
      <View className="card">
        <Text className="section-title">监护人数据控制</Text>
        <Text className="muted">
          你可以导出当前家庭数据，或为某个儿童提交删除申请。删除会保留必要的最小审计记录。
        </Text>
        <Button className="secondary-button" onClick={() => void exportData()}>
          导出家庭数据
        </Button>
        {children.map((child) => (
          <Button
            className="action-row"
            key={child.child_id}
            onClick={() => void requestDeletion(child)}
          >
            申请删除 {child.display_name} 的数据
          </Button>
        ))}
      </View>
    </View>
  );
}
