import type { PermissionKey, UserRole, UserSession } from "../types";

const SESSION_KEY = "hudmp.admin.session.v1";

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) {
    return false;
  }
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

export const rolePermissions: Record<UserRole, PermissionKey[]> = {
  platform_admin: [
    "dashboard.view",
    "dictionaries.manage",
    "departments.manage",
    "equipment.manage",
    "materials.manage",
    "imports.manage",
    "mapping.review",
    "exchange.view",
    "permissions.manage",
    "raw_payload.view"
  ],
  data_steward: [
    "dashboard.view",
    "dictionaries.manage",
    "departments.manage",
    "equipment.manage",
    "materials.manage",
    "imports.manage",
    "mapping.review"
  ],
  auditor: ["dashboard.view", "exchange.view"]
};

export function hasPermission(session: UserSession | null, permission?: PermissionKey): boolean {
  if (!permission) {
    return true;
  }
  if (!session) {
    return false;
  }
  if (session.backendPermissions) {
    if (
      permission === "dictionaries.manage" &&
      (session.backendPermissions.includes("departments.manage") ||
        session.backendPermissions.includes("equipment.manage") ||
        session.backendPermissions.includes("materials.manage"))
    ) {
      return true;
    }
    if (permission === "equipment.manage" && session.backendPermissions.includes("dictionaries.manage")) {
      return true;
    }
    return session.backendPermissions.includes(permission);
  }
  return rolePermissions[session.role].includes(permission);
}

export function loadSession(): UserSession | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserSession>;
    if (!parsed.username || !parsed.role || !(parsed.role in rolePermissions)) {
      clearSession();
      return null;
    }
    if (isExpired(parsed.sessionExpiresAt)) {
      clearSession();
      return null;
    }
    return {
      username: parsed.username,
      displayName: parsed.displayName || parsed.username,
      role: parsed.role,
      signedInAt: parsed.signedInAt || new Date().toISOString(),
      sessionToken: parsed.sessionToken,
      sessionExpiresAt: parsed.sessionExpiresAt,
      backendPermissions: parsed.backendPermissions,
      authModel: parsed.authModel,
      personId: parsed.personId,
      personName: parsed.personName,
      departmentName: parsed.departmentName,
      position: parsed.position,
      systems: parsed.systems,
      accessToken: parsed.accessToken,
    };
  } catch {
    clearSession();
    return null;
  }
}

export function saveSession(session: UserSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}
