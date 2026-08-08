import Taro from "@tarojs/taro";
import { request } from "./http";
import type { Session } from "../models";

export interface LoginResult {
  session: Session;
  token: string;
  refreshToken: string;
}

/**
 * 微信小程序登录流程：
 * 1. wx.login() 获取 code
 * 2. 用 code 换取 BOKS session token
 */
export async function wechatLogin(): Promise<LoginResult> {
  const { code } = await Taro.login();
  const resp = await request<{
    session: Session;
    token: string;
    refresh_token: string;
  }>("/auth/wechat/exchange", {
    method: "POST",
    data: { code },
  });

  return {
    session: resp.session,
    token: resp.token,
    refreshToken: resp.refresh_token,
  };
}

/**
 * 用 refresh_token 刷新 access token
 */
export async function refreshSession(
  refreshToken: string,
): Promise<{ token: string; newRefreshToken: string }> {
  const resp = await request<{
    token: string;
    refresh_token: string;
  }>("/auth/refresh", {
    method: "POST",
    data: { refresh_token: refreshToken },
  });
  return {
    token: resp.token,
    newRefreshToken: resp.refresh_token,
  };
}

/**
 * 退出登录，清除本地存储
 */
export function logout(): void {
  try {
    Taro.removeStorageSync("boks.session.token");
    Taro.removeStorageSync("boks.session.refresh-token");
  } catch {
    // ignore
  }
}

/**
 * 检查是否有有效 session（含 dev login fallback）
 */
export async function ensureAuth(): Promise<boolean> {
  const token = Taro.getStorageSync<string>("boks.session.token");
  if (token) return true;

  // 本地调试环境自动模拟登录
  const result = await devLogin();
  if (result) {
    Taro.setStorageSync("boks.session.token", result.token);
    Taro.setStorageSync("boks.session.refresh-token", result.refreshToken);
    return true;
  }
  return false;
}

async function devLogin(): Promise<{ token: string; refreshToken: string } | null> {
  try {
    const resp = await request<{
      token: string;
      refresh_token: string;
    }>("/auth/dev-login", {
      method: "POST",
      data: { guardian_id: "guardian-demo-001" },
    });
    return {
      token: resp.token,
      refreshToken: resp.refresh_token,
    };
  } catch {
    return null;
  }
}