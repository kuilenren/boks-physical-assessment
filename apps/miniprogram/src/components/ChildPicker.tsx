import { Picker, Text, View } from "@tarojs/components";
import type { ChildProfile } from "../models";
import { Icon } from "./Icon";

export function ChildPicker({
  children,
  value,
  onChange,
}: {
  children: ChildProfile[];
  value: string;
  onChange: (childId: string) => void;
}) {
  const index = Math.max(
    0,
    children.findIndex((child) => child.child_id === value),
  );

  return (
    <View>
      <Text className="field-label">选择孩子</Text>
      <Picker
        mode="selector"
        range={children.map((child) => child.display_name)}
        value={index}
        onChange={(event) =>
          onChange(children[Number(event.detail.value)]?.child_id ?? value)
        }
      >
        <View
          className="picker-field"
          style={{ justifyContent: "space-between" }}
        >
          <Text>{children[index]?.display_name ?? "请选择孩子"}</Text>
          <Icon name="arrow" size={16} tone="brand" />
        </View>
      </Picker>
    </View>
  );
}
