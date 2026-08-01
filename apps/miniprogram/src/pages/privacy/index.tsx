import { Text, View } from "@tarojs/components";

export default function PrivacyPage() {
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
    </View>
  );
}
