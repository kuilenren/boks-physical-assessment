import Taro from "@tarojs/taro";

const SESSION_TOKEN_KEY = "boks.session.token";
const SESSION_REFRESH_KEY = "boks.session.refresh-token";

export interface SessionState {
  token: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
}

export function getSessionState(): SessionState {
  const token = Taro.getStorageSync<string>(SESSION_TOKEN_KEY) ?? null;
  const refreshToken = Taro.getStorageSync<string>(SESSION_REFRESH_KEY) ?? null;
  return {
    token,
    refreshToken,
    isLoggedIn: !!token,
  };
}

export function setSessionToken(token: string, refreshToken: string): void {
  Taro.setStorageSync(SESSION_TOKEN_KEY, token);
  Taro.setStorageSync(SESSION_REFRESH_KEY, refreshToken);
}

export function clearSession(): void {
  Taro.removeStorageSync(SESSION_TOKEN_KEY);
  Taro.removeStorageSync(SESSION_REFRESH_KEY);
}

export function hasSession(): boolean {
  return !!Taro.getStorageSync<string>(SESSION_TOKEN_KEY);
}
