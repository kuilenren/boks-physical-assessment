import { Button, Text, View } from "@tarojs/components";
import { IconBadge } from "./Icon";

export function LoadingState({ message = "正在加载，请稍候…" }: { message?: string }) {
  return (
    <View className="card loading-state">
      <IconBadge name="leaf" tone="brand" size={48} />
      <Text className="section-title">加载中</Text>
      <Text className="muted">{message}</Text>
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
    <View className="card error-state">
      <IconBadge name="alert" tone="danger" size={48} />
      <Text className="section-title">暂时无法完成</Text>
      <Text className="muted">{message}</Text>
      <Button className="secondary-button" onClick={onRetry}>
        重新加载
      </Button>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="card empty-state">
      <IconBadge name="spark" tone="brand" size={48} />
      <Text className="section-title">{title}</Text>
      <Text className="muted">{message}</Text>
      {actionLabel && onAction ? (
        <Button className="primary-button" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}