import { Picker, Text, View } from "@tarojs/components";
import type { ChildProfile } from "../models";

export function ChildPicker({
  children,
  value,
  onChange,
}: {
  children: ChildProfile[] | undefined;
  value: string;
  onChange: (childId: string) => void;
}) {
  const safeChildren = children || [];
  const index = Math.max(
    0,
    safeChildren.findIndex((child) => child.child_id === value),
  );

  return (
    <View>
      <Text className="field-label">选择孩子</Text>
      <Picker
        mode="selector"
        range={safeChildren.map((child) => child.display_name)}
        value={index}
        onChange={(event) =>
          onChange(safeChildren[Number(event.detail.value)]?.child_id ?? value)
        }
      >
        <View className="picker-field">
          {safeChildren[index]?.display_name ?? "请选择孩子"}
        </View>
      </Picker>
    </View>
  );
}
