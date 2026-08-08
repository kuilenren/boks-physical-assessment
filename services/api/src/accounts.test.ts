import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as db from "./demo-store.js";
import * as auth from "./auth.js";
import { AuthController } from "./auth.controller.js";

const testFile = join(process.cwd(), "data", "boks-store.json");
afterAll(() => {
  if (existsSync(testFile)) rmSync(testFile);
});

beforeEach(() => db.resetDemoStore());

function requestWith(token: string) {
  return {
    headers: { authorization: `Bearer ${token}` },
  } as unknown as import("express").Request;
}

function errorCode(fn: () => unknown): string {
  try {
    fn();
    throw new Error("expected to throw");
  } catch (error) {
    const body = (error as { response?: { error?: { code?: string } } }).response;
    return body?.error?.code ?? String(error);
  }
}

describe("account & role system", () => {
  it("bootstraps the first super admin and creates its organization", () => {
    expect(db.hasSuperAdmin()).toBe(false);
    const controller = new AuthController();
    const response = controller.setupSuperAdmin(
      {
        org_name: "示例学校",
        display_name: "校长",
        username: "principal",
        password: "Password123",
      },
      { headers: {} } as import("express").Request,
    );
    expect(response.data.organization.name).toBe("示例学校");
    expect(response.data.account.role).toBe("super_admin");
    expect(response.data.account.org_id).toBe(response.data.organization.id);
    expect(db.hasSuperAdmin()).toBe(true);
    expect(response.data.session.role).toBe("super_admin");
  });

  it("rejects a second super admin bootstrap", () => {
    const controller = new AuthController();
    controller.setupSuperAdmin(
      {
        org_name: "示例学校",
        display_name: "校长",
        username: "principal",
        password: "Password123",
      },
      { headers: {} } as import("express").Request,
    );
    expect(errorCode(() =>
      controller.setupSuperAdmin(
        {
          org_name: "另一所学校",
          display_name: "另一个校长",
          username: "principal-2",
          password: "Password456",
        },
        { headers: {} } as import("express").Request,
      ),
    )).toBe("SUPER_ADMIN_EXISTS");
  });

  it("logs in with username + password and carries role/org", async () => {
    const controller = new AuthController();
    controller.setupSuperAdmin(
      {
        org_name: "示例学校",
        display_name: "校长",
        username: "principal",
        password: "Password123",
      },
      { headers: {} } as import("express").Request,
    );
    const session = await auth.loginWithPassword("principal", "Password123");
    expect(session.role).toBe("super_admin");
    expect(session.account_id).toBeTruthy();
    expect(session.org_id).toBeTruthy();
    const context = auth.guardianContext(requestWith(session.token));
    expect(context.role).toBe("super_admin");
    expect(context.account_id).toBe(session.account_id);
  });

  it("rejects a wrong password", async () => {
    const controller = new AuthController();
    controller.setupSuperAdmin(
      {
        org_name: "示例学校",
        display_name: "校长",
        username: "principal",
        password: "Password123",
      },
      { headers: {} } as import("express").Request,
    );
    await expect(
      auth.loginWithPassword("principal", "WrongPass123"),
    ).rejects.toMatchObject({ response: { error: { code: "ACCOUNT_PASSWORD_INVALID" } } });
  });

  it("super admin opens a staff account, which cannot access admin-only routes", async () => {
    const controller = new AuthController();
    controller.setupSuperAdmin(
      {
        org_name: "示例学校",
        display_name: "校长",
        username: "principal",
        password: "Password123",
      },
      { headers: {} } as import("express").Request,
    );
    const principal = await auth.loginWithPassword("principal", "Password123");
    const created = controller.createAccountRoute(
      {
        role: "staff",
        display_name: "体育老师",
        username: "teacher-01",
        password: "Teacher123",
      },
      requestWith(principal.token),
    );
    expect(created.data).not.toBeNull();
    expect(created.data?.username).toBe("teacher-01");
    expect(created.data?.role).toBe("staff");
    expect(created.data?.org_id).toBe(principal.org_id);
    expect(JSON.stringify(created)).not.toContain("password_hash");

    const teacher = await auth.loginWithPassword("teacher-01", "Teacher123");
    expect(teacher.role).toBe("staff");
    expect(errorCode(() => controller.accounts(requestWith(teacher.token)))).toBe(
      "ROLE_REQUIRED",
    );
  });

  it("requires super admin to list accounts", async () => {
    const controller = new AuthController();
    const session = auth.createSession("guardian-demo-001");
    expect(errorCode(() => controller.accounts(requestWith(session.token)))).toBe(
      "ROLE_REQUIRED",
    );
  });

  it("rejects creating an account without credentials", async () => {
    const controller = new AuthController();
    controller.setupSuperAdmin(
      {
        org_name: "示例学校",
        display_name: "校长",
        username: "principal",
        password: "Password123",
      },
      { headers: {} } as import("express").Request,
    );
    const principal = await auth.loginWithPassword("principal", "Password123");
    expect(
      errorCode(() =>
        controller.createAccountRoute(
          { role: "staff", display_name: "无名老师" },
          requestWith(principal.token),
        ),
      ),
    ).toBe("ACCOUNT_CREDENTIAL_REQUIRED");
  });

  it("disables an account and prevents login", async () => {
    const controller = new AuthController();
    controller.setupSuperAdmin(
      {
        org_name: "示例学校",
        display_name: "校长",
        username: "principal",
        password: "Password123",
      },
      { headers: {} } as import("express").Request,
    );
    const principal = await auth.loginWithPassword("principal", "Password123");
    const created = controller.createAccountRoute(
      {
        role: "staff",
        display_name: "体育老师",
        username: "teacher-01",
        password: "Teacher123",
      },
      requestWith(principal.token),
    );
    controller.accountStatus(
      created.data?.id ?? "",
      { status: "disabled" },
      requestWith(principal.token),
    );
    await expect(
      auth.loginWithPassword("teacher-01", "Teacher123"),
    ).rejects.toMatchObject({ response: { error: { code: "ACCOUNT_DISABLED" } } });
  });

  it("phone login with dev code resolves an account when configured", async () => {
    const controller = new AuthController();
    controller.setupSuperAdmin(
      {
        org_name: "示例学校",
        display_name: "校长",
        username: "principal",
        password: "Password123",
      },
      { headers: {} } as import("express").Request,
    );
    const principal = await auth.loginWithPassword("principal", "Password123");
    controller.createAccountRoute(
      {
        role: "parent",
        display_name: "家长",
        phone: "+8613800000000",
        family_id: "family-demo-001",
      },
      requestWith(principal.token),
    );
    const session = await auth.loginWithPhone("+8613800000000", "000000");
    expect(session.role).toBe("parent");
    expect(session.family_id).toBe("family-demo-001");
  });

  it("persists accounts and organizations through an atomic write", async () => {
    const controller = new AuthController();
    controller.setupSuperAdmin(
      {
        org_name: "示例学校",
        display_name: "校长",
        username: "principal",
        password: "Password123",
      },
      { headers: {} } as import("express").Request,
    );
    await db.persistStore();
    const raw = existsSync(testFile)
      ? (JSON.parse(
          readFileSync(testFile, "utf8"),
        ) as unknown as { accounts: Record<string, unknown> })
      : { accounts: {} };
    expect(Object.keys(raw.accounts).length).toBe(1);
  });
});
