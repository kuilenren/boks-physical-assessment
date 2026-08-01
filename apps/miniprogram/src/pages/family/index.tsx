import { Button, Input, Picker, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import type { ChildProfile } from "../../models";
import { createChild, listChildren } from "../../services/family";
import { ErrorState, LoadingState } from "../../components/PageState";
import { formatDate } from "../../utils/format";
import { showError } from "../../utils/error";

const sexOptions: Array<{ label: string; value: ChildProfile["sex"] }> = [
  { label: "未选择", value: "unknown" },
  { label: "男", value: "male" },
  { label: "女", value: "female" },
];

export default function FamilyPage() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sexIndex, setSexIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setChildren(await listChildren());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "儿童档案加载失败。",
      );
    } finally {
      setLoading(false);
    }
  };

  useLoad(() => {
    void load();
  });

  const save = async () => {
    if (!name.trim() || !birthDate) {
      void Taro.showToast({ title: "请完整填写姓名和出生日期", icon: "none" });
      return;
    }
    setSaving(true);
    try {
      await createChild({
        display_name: name.trim(),
        birth_date: birthDate,
        sex: sexOptions[sexIndex].value,
      });
      setName("");
      setBirthDate("");
      setSexIndex(0);
      await load();
      void Taro.showToast({ title: "档案已保存", icon: "success" });
    } catch (saveError) {
      showError(saveError, "档案保存失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="page">
      <Text className="page-title">儿童档案</Text>
      <Text className="page-subtitle">
        只为 BOKS 自有学生家庭服务，信息由监护人维护。
      </Text>

      {loading ? <LoadingState /> : null}
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : null}
      {!loading && !error ? (
        <View className="card">
          <Text className="section-title">已有档案</Text>
          {children.length === 0 ? (
            <Text className="muted">还没有儿童档案。</Text>
          ) : null}
          {children.map((child) => (
            <View className="list-row" key={child.child_id}>
              <View>
                <Text className="child-name">{child.display_name}</Text>
                <Text className="muted">
                  {formatDate(child.birth_date)} · {child.grade_stage}
                </Text>
              </View>
              <Text className="status-pill">
                {child.status === "active" ? "正常" : "已停用"}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="card">
        <Text className="section-title">添加儿童</Text>
        <Text className="field-label">称呼</Text>
        <Input
          className="field-input"
          value={name}
          placeholder="例如：小宇"
          maxlength={30}
          onInput={(event) => setName(event.detail.value)}
        />
        <Text className="field-label">出生日期</Text>
        <Picker
          mode="date"
          value={birthDate || "2018-01-01"}
          end={new Date().toISOString().slice(0, 10)}
          onChange={(event) => setBirthDate(event.detail.value)}
        >
          <View className="picker-field">{birthDate || "请选择出生日期"}</View>
        </Picker>
        <Text className="field-label">性别（可选）</Text>
        <Picker
          mode="selector"
          range={sexOptions.map((option) => option.label)}
          value={sexIndex}
          onChange={(event) => setSexIndex(Number(event.detail.value))}
        >
          <View className="picker-field">{sexOptions[sexIndex].label}</View>
        </Picker>
        <Button
          className="primary-button"
          loading={saving}
          onClick={() => void save()}
        >
          保存档案
        </Button>
      </View>
    </View>
  );
}
