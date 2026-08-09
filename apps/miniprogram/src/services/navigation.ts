import {
  navigateTo,
  redirectTo,
  switchTab,
  getStorageSync,
  setStorageSync,
} from "@tarojs/taro";

const TAB_PATHS = new Set([
  "/pages/home/index",
  "/pages/assessment/start",
  "/pages/training/detail",
  "/pages/family/index",
]);

const TAB_PARAMS_KEY = "boks.tab-params";

interface RouteParams {
  [key: string]: string | undefined;
}

function parseQuery(query: string): RouteParams {
  const params: RouteParams = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const separator = pair.indexOf("=");
    if (separator < 0) {
      params[decodeURIComponent(pair)] = "true";
    } else {
      params[decodeURIComponent(pair.slice(0, separator))] = decodeURIComponent(
        pair.slice(separator + 1),
      );
    }
  }
  return params;
}

function storedTabParams(): Record<string, RouteParams> {
  const value = getStorageSync(TAB_PARAMS_KEY);
  if (typeof value !== "object" || value === null) return {};
  return value as Record<string, RouteParams>;
}

export function readTabParams(): Record<string, RouteParams> {
  return storedTabParams();
}

function writeTabParams(path: string, params: RouteParams): void {
  const next = { ...storedTabParams(), [path]: params };
  setStorageSync(TAB_PARAMS_KEY, next);
}

export function openTab(path: string, params: RouteParams = {}): void {
  writeTabParams(path, params);
  void switchTab({ url: path }).catch(() => {
    // 小程序重复打开当前 Tab 不会失败；此处仅防御性吞掉平台异常。
  });
}

export function openPage(path: string, params: RouteParams = {}): void {
  const query = Object.entries(params)
    .filter((entry) => entry[1] !== undefined && entry[1] !== "")
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
  void navigateTo({ url: query ? `${path}?${query}` : path });
}

export function replacePage(path: string, params: RouteParams = {}): void {
  const query = Object.entries(params)
    .filter((entry) => entry[1] !== undefined && entry[1] !== "")
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
  void redirectTo({ url: query ? `${path}?${query}` : path });
}

export function openRoute(
  path: string,
  params: RouteParams = {},
  query: string = "",
): void {
  const resolvedParams = parseQuery(query);
  if (TAB_PATHS.has(path)) {
    openTab(path, { ...resolvedParams, ...params });
    return;
  }
  openPage(path, { ...resolvedParams, ...params });
}
