import React from "react";
import { KeyRound, LoaderCircle, LogIn, LogOut, ShieldCheck, UserCog } from "lucide-react";
import { hasPermission, rolePermissions } from "../lib/auth";
import { APP_SHORT_NAME } from "../lib/appIdentity";
import { permissionLabels, roleLabels } from "../lib/i18n";
import type {
  AdminConfig,
  Language,
  OperatorDirectory,
  PermissionKey,
  PermissionMatrix,
  UserRole,
  UserSession
} from "../types";

type AuthWorkbenchProps = {
  config: AdminConfig;
  language: Language;
  session: UserSession | null;
  backendMatrix: PermissionMatrix | null;
  operatorDirectory: OperatorDirectory | null;
  onLogin: (usernameOrEmployeeId: string, password: string) => Promise<string | null>;
  onLogout: () => void;
  loginOnly?: boolean;
};

const roleOptions: UserRole[] = ["platform_admin", "data_steward", "auditor"];

const copy = {
  en: {
    account: "Account",
    loginTitle: `${APP_SHORT_NAME} Login`,
    username: "Username or employee ID",
    displayName: "Display name",
    role: "Role",
    password: "Password",
    passwordPlaceholder: "Account password",
    signIn: "Sign in",
    signOut: "Sign out",
    currentSession: "Current session",
    notSignedIn: "Not signed in",
    signedInAt: "Signed in at",
    permissions: "Permissions",
    roleMatrix: "Role matrix",
    matrixSource: "Matrix source",
    allowed: "Allowed",
    blocked: "Blocked",
    note: "Operator accounts, roles, and permissions are provisioned by administrators.",
    backendPermissions: "Backend permissions",
    authModel: "Auth model",
    expiresAt: "Expires at",
    configuredOperators: "Provisioned operators",
    accountSource: "Account source",
    passwordType: "Password type",
    noOperators: "No provisioned operator accounts returned.",
    passwordRequired: "Password is required.",
    usernameRequired: "Username or employee ID is required."
  },
  zh: {
    account: "账号",
    loginTitle: `${APP_SHORT_NAME} 登录`,
    username: "用户名或工号",
    displayName: "显示名称",
    role: "角色",
    password: "密码",
    passwordPlaceholder: "账号密码",
    signIn: "登录",
    signOut: "退出",
    currentSession: "当前会话",
    notSignedIn: "未登录",
    signedInAt: "登录时间",
    permissions: "权限",
    roleMatrix: "角色权限",
    matrixSource: "权限来源",
    allowed: "允许",
    blocked: "禁止",
    note: "操作员账号、角色和权限由管理员预先配置。",
    backendPermissions: "系统权限",
    authModel: "登录方式",
    expiresAt: "过期时间",
    configuredOperators: "操作员账号",
    accountSource: "账号来源",
    passwordType: "密码类型",
    noOperators: "未返回预置操作员账号。",
    passwordRequired: "请输入密码。",
    usernameRequired: "请输入用户名或工号。"
  }
};

function c(language: Language, key: keyof typeof copy.en): string {
  return copy[language][key];
}

function formatDate(value?: string): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function AuthWorkbench({
  config,
  language,
  session,
  backendMatrix,
  operatorDirectory,
  onLogin,
  onLogout,
  loginOnly = false
}: AuthWorkbenchProps) {
  const [username, setUsername] = React.useState(session?.username ?? "");
  const [password, setPassword] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const [signingIn, setSigningIn] = React.useState(false);

  React.useEffect(() => {
    setUsername(session?.username ?? "");
  }, [session?.username]);

  const canManagePermissions = hasPermission(session, "permissions.manage");

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!username.trim()) {
      setNotice(c(language, "usernameRequired"));
      return;
    }
    if (!password.trim()) {
      setNotice(c(language, "passwordRequired"));
      return;
    }
    setSigningIn(true);
    const error = await onLogin(username.trim(), password);
    if (!error) {
      setPassword("");
    }
    setNotice(error);
    setSigningIn(false);
  };

  return (
    <>
      <section className={loginOnly ? "panel auth-panel login-card" : "panel auth-panel"} aria-labelledby="auth-login-heading">
        <div className="panel-heading">
          <div>
            {!loginOnly ? <p className="eyebrow">{c(language, "account")}</p> : null}
            <h2 id="auth-login-heading">{c(language, "loginTitle")}</h2>
          </div>
          <KeyRound size={20} />
        </div>
        {notice ? <div className="notice-line">{notice}</div> : null}
        <div className={loginOnly ? "login-auth-layout" : "permission-layout"}>
          <form className="auth-form" onSubmit={submit}>
            <label className="field">
              <span>{c(language, "username")}</span>
              <input
                value={username}
                autoComplete="username"
                autoFocus={loginOnly}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setNotice(null);
                }}
              />
            </label>
            <label className="field">
              <span>{c(language, "password")}</span>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                placeholder={c(language, "passwordPlaceholder")}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setNotice(null);
                }}
              />
            </label>
            <div className="button-row">
              <button className="action-button" type="submit" disabled={signingIn}>
                {signingIn ? <LoaderCircle size={16} className="spin" /> : <LogIn size={16} />}
                {c(language, "signIn")}
              </button>
              {!loginOnly ? (
                <button className="tool-button" type="button" onClick={onLogout} disabled={!session}>
                <LogOut size={16} />
                {c(language, "signOut")}
              </button>
              ) : null}
            </div>
          </form>
          {!loginOnly ? (
            <div className="session-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{c(language, "currentSession")}</p>
                <h2>{session?.displayName ?? c(language, "notSignedIn")}</h2>
              </div>
              <UserCog size={20} />
            </div>
            <dl>
              <div>
                <dt>{c(language, "username")}</dt>
                <dd>{session?.username ?? "-"}</dd>
              </div>
              <div>
                <dt>{c(language, "role")}</dt>
                <dd>{session ? roleLabels[language][session.role] : "-"}</dd>
              </div>
              <div>
                <dt>{c(language, "signedInAt")}</dt>
                <dd>{formatDate(session?.signedInAt)}</dd>
              </div>
              <div>
                <dt>{c(language, "expiresAt")}</dt>
                <dd>{formatDate(session?.sessionExpiresAt)}</dd>
              </div>
              <div>
                <dt>{c(language, "authModel")}</dt>
                <dd>{session?.authModel ?? "-"}</dd>
              </div>
              <div>
                <dt>{c(language, "backendPermissions")}</dt>
                <dd>{session?.backendPermissions?.join(", ") ?? "-"}</dd>
              </div>
            </dl>
          </div>
          ) : null}
        </div>
        {!loginOnly ? (
          <div className="config-note">
          <ShieldCheck size={17} />
          <span>{c(language, "note")}</span>
        </div>
        ) : null}
      </section>

      {!loginOnly && canManagePermissions ? (
        <section className="panel auth-panel" aria-labelledby="permission-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{c(language, "permissions")}</p>
            <h2 id="permission-heading">{c(language, "roleMatrix")}</h2>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="section-toolbar">
          <span>
            {c(language, "matrixSource")}: {backendMatrix?.source ?? "local"}
          </span>
        </div>
        <div className="data-table permission-table" role="table" aria-label="Role permission matrix">
          <div role="row">
            <span role="columnheader">{c(language, "permissions")}</span>
            {roleOptions.map((item) => (
              <span role="columnheader" key={item}>
                {roleLabels[language][item]}
              </span>
            ))}
          </div>
          {(Object.keys(permissionLabels[language]) as PermissionKey[]).map((permission) => (
            <div role="row" key={permission}>
              <span>{permissionLabels[language][permission]}</span>
              {roleOptions.map((item) => {
                const backendRole = backendMatrix?.roles.find((roleRow) => roleRow.role === item);
                const allowed = (backendRole?.permissions ?? rolePermissions[item]).includes(permission);
                return (
                  <span key={item}>
                    <span className={`mini-pill ${allowed ? "mini-pill-ok" : "mini-pill-warn"}`}>
                      {allowed ? c(language, "allowed") : c(language, "blocked")}
                    </span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {!loginOnly && canManagePermissions ? (
        <section className="panel auth-panel" aria-labelledby="operators-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{c(language, "account")}</p>
              <h2 id="operators-heading">{c(language, "configuredOperators")}</h2>
            </div>
            <UserCog size={20} />
          </div>
          <div className="section-toolbar">
            <span>
              {c(language, "accountSource")}: {operatorDirectory?.source ?? "backend"}
            </span>
          </div>
          {operatorDirectory?.accounts.length ? (
            <div className="data-table operator-directory-table" role="table" aria-label="Provisioned operators">
              <div role="row">
                <span role="columnheader">{c(language, "username")}</span>
                <span role="columnheader">{c(language, "displayName")}</span>
                <span role="columnheader">{c(language, "role")}</span>
                <span role="columnheader">{c(language, "backendPermissions")}</span>
                <span role="columnheader">{c(language, "passwordType")}</span>
              </div>
              {operatorDirectory.accounts.map((account) => (
                <div role="row" key={account.username}>
                  <span>{account.username}</span>
                  <span>{account.display_name}</span>
                  <span>{roleLabels[language][account.role]}</span>
                  <span>{account.permissions.map((permission) => permissionLabels[language][permission]).join(", ")}</span>
                  <span>{account.password_type}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{c(language, "noOperators")}</div>
          )}
        </section>
      ) : null}
    </>
  );
}
