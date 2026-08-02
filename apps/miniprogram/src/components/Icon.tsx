/**
 * BOKS 图标（currentColor 透传，dark mode 自动跟随）
 * 用法：<Icon name="home" /> 默认 20px；tone 透传父级 color
 */
type IconName =
  | "home"
  | "assessment"
  | "posture"
  | "training"
  | "family"
  | "chat"
  | "shield"
  | "report"
  | "arrow"
  | "check"
  | "alert"
  | "plus"
  | "spark"
  | "camera"
  | "leaf"
  | "me";

const SYMBOLS: Record<IconName, string> = {
  home: "boks-home",
  assessment: "boks-assessment",
  posture: "boks-posture",
  training: "boks-training",
  family: "boks-family",
  chat: "boks-chat",
  shield: "boks-shield",
  report: "boks-report",
  arrow: "boks-arrow",
  check: "boks-check",
  alert: "boks-alert",
  plus: "boks-plus",
  spark: "boks-spark",
  camera: "boks-camera",
  leaf: "boks-leaf",
  me: "boks-me",
};

const SPRITE_PATH = "/assets/icons/sprite.svg";

export function Icon({
  name,
  size = 20,
  className = "",
  ariaLabel,
}: {
  name: IconName;
  size?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const symbol = SYMBOLS[name];
  return (
    <svg
      className={`ui-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={ariaLabel ? "img" : "presentation"}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <use href={`${SPRITE_PATH}#${symbol}`} />
    </svg>
  );
}

export function IconBadge({
  name,
  tone = "brand",
  size = 44,
  className = "",
  ariaLabel,
}: {
  name: IconName;
  tone?: "brand" | "forest" | "sky" | "amber" | "ink" | "white" | "danger";
  size?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const toneColor =
    tone === "white"
      ? "var(--color-surface-white)"
      : tone === "brand"
        ? "var(--color-brand-700)"
        : tone === "forest"
          ? "var(--color-brand-900)"
          : tone === "sky"
            ? "var(--color-sky-600)"
            : tone === "amber"
              ? "var(--color-amber-700)"
              : tone === "danger"
                ? "var(--color-danger-600)"
                : "var(--color-ink-800)";
  return (
    <View
      className={`icon-badge icon-badge-${tone} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        color: toneColor,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-pill)",
      }}
    >
      <Icon name={name} size={Math.round(size * 0.48)} ariaLabel={ariaLabel} />
    </View>
  );
}

// 兼容旧 API
export type { IconName };

import { View } from "@tarojs/components";