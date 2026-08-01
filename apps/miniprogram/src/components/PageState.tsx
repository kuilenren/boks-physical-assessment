import { Button, View, Text } from "@tarojs/components";

export function LoadingState() {
  return (
    <View className="card">
      <Text className="muted">正在加载，请稍候…</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="card">
      <Text className="danger-note">{message}</Text>
      <Button className="secondary-button" onClick={onRetry}>
        重新加载
      </Button>
    </View>
  );
}
