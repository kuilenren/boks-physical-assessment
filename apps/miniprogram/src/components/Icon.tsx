import { Image } from '@tarojs/components';

/**
 * BOKS 图标（currentColor 透传，dark mode 自动跟随）
 * 平台差异：
 *   - weapp：<svg><use> 不被支持；用 Image 引用 base64 内嵌 SVG（按需）
 *   - h5/web：直接使用 <svg><use href="...">（外部 sprite）
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

// 内联 SVG path（按图标命名空间；h5/web 走 sprite，weapp 走 inline Image）
const PATHS: Record<IconName, string> = {
  home: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z",
  assessment:
    "M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm7 1.5V8h3.5M8 12h8M8 16h6M8 8h3",
  posture:
    "M12 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 10h4l1.5 4.5L18 20h-2.2l-1.6-4h-2.4L10.2 20H8l2.5-5.5L10 10z",
  training:
    "M5 9h2v10H5V9zm12 0h2v10h-2V9zM8.5 11h7v2h-7v-2zm0 4h7v2h-7v-2zM4 7h4v2H4V7zm12 0h4v2h-4V7z",
  family:
    "M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-7.5 8a5.5 5.5 0 0 1 11 0v1h-11v-1z",
  chat: "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  shield:
    "M12 3 5 6v5.5c0 4.4 2.9 7.6 7 8.5 4.1-.9 7-4.1 7-8.5V6l-7-3zm-1 11.2-2.7-2.7 1.4-1.4L11 11.4l3.8-3.8 1.4 1.4L11 14.2z",
  report:
    "M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm8 1.5V8h2.5M8 12h8M8 15h6M8 18h4",
  arrow: "M9 6l6 6-6 6",
  check: "M5.5 12.5 10 17l8.5-9",
  alert: "M12 4 3.5 19h17L12 4zm0 5v5m0 3.2h.01",
  plus: "M12 6v12M6 12h12",
  spark:
    "M12 3.5 13.6 9H19l-4.3 3.2L16.4 18 12 14.8 7.6 18l1.7-5.8L5 9h5.4L12 3.5z",
  camera:
    "M9 7 10.2 5h3.6L15 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3zm3 3.2a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6z",
  leaf: "M6 18c6-1 10-5 12-12-7 2-11 6-12 12zm0 0c2-4 6-7 10-8",
  me: "M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 12a8 8 0 0 1 16 0",
};

const TONES = {
  brand: "#1f6e45",
  forest: "#103e2f",
  sky: "#2c718a",
  amber: "#8a5a00",
  ink: "#315449",
  white: "#ffffff",
  danger: "#b42318",
} as const;

type IconTone = keyof typeof TONES;

function toDataUri(name: IconName, color: string): string {
  const path = PATHS[name];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function Icon({
  name,
  size = 20,
  className = "",
  ariaLabel,
  tone,
}: {
  name: IconName;
  size?: number;
  className?: string;
  ariaLabel?: string;
  tone?: IconTone;
}) {
  // weapp / h5 通用：data:image/svg+xml 内嵌（无网络、无 use href）
  const src = toDataUri(name, tone ? TONES[tone] : "currentColor");
  return (
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — weapp does not support role/aria on image
    <Image
      className={`ui-icon ${className}`}
      src={src}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        color: "inherit",
      }}
    />
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
  tone?: IconTone;
  size?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const toneColor = TONES[tone];
  return (
    <view
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
    </view>
  );
}

// 兼容旧 API
export type { IconName };
export const ICON_SPRITE_PATH = SPRITE_PATH;
export const ICON_SYMBOLS = SYMBOLS;
