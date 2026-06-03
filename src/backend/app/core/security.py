from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import hashlib
import hmac
from typing import Any

import bcrypt
import jwt
from fastapi import Header, HTTPException
from sqlalchemy import select

from app.core.config import get_settings


@dataclass(frozen=True)
class OperatorAccount:
    username: str
    password: str
    role: str
    display_name: str


@dataclass(frozen=True)
class OperatorContext:
    name: str
    role: str
    display_name: str | None = None
    auth_model: str = "service_api_key_with_operator_context"
    session_expires_at: int | None = None

    @property
    def permissions(self) -> set[str]:
        return ROLE_PERMISSIONS.get(self.role, set())


ROLE_PERMISSIONS = {
    "SYS_ADMIN": {
        "dashboard.view",
        "dictionaries.manage",
        "departments.manage",
        "equipment.manage",
        "materials.manage",
        "vendors.manage",
        "imports.manage",
        "mapping.review",
        "exchange.view",
        "permissions.manage",
        "raw_payload.view",
    },
    "DATA_STEWARD": {
        "dashboard.view",
        "dictionaries.manage",
        "departments.manage",
        "equipment.manage",
        "materials.manage",
        "vendors.manage",
        "imports.manage",
        "mapping.review",
    },
    "DATA_ADMIN": {
        "dashboard.view",
        "dictionaries.manage",
        "departments.manage",
        "equipment.manage",
        "materials.manage",
        "vendors.manage",
        "imports.manage",
        "mapping.review",
    },
    "AUDITOR": {"dashboard.view", "exchange.view"},
    "AUDIT_ADMIN": {"dashboard.view", "exchange.view"},
    "platform_admin": {
        "dashboard.view",
        "dictionaries.manage",
        "departments.manage",
        "equipment.manage",
        "materials.manage",
        "vendors.manage",
        "imports.manage",
        "mapping.review",
        "exchange.view",
        "permissions.manage",
        "raw_payload.view",
    },
    "data_steward": {
        "dashboard.view",
        "dictionaries.manage",
        "departments.manage",
        "equipment.manage",
        "materials.manage",
        "vendors.manage",
        "imports.manage",
        "mapping.review",
    },
    "auditor": {"dashboard.view", "exchange.view"},
}


# ---- bcrypt 工具 ----

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---- 配置驱动账号（兼容降级） ----

def configured_operator_accounts() -> dict[str, OperatorAccount]:
    settings = get_settings()
    accounts: dict[str, OperatorAccount] = {}
    for raw_item in settings.operator_users.split(";"):
        item = raw_item.strip()
        if not item:
            continue
        parts = [part.strip() for part in item.split("|")]
        if len(parts) < 3:
            continue
        username, password, role = parts[:3]
        display_name = parts[3] if len(parts) >= 4 and parts[3] else username
        if role in ROLE_PERMISSIONS:
            accounts[username.lower()] = OperatorAccount(
                username=username,
                password=password,
                role=role,
                display_name=display_name,
            )
    return accounts


def _legacy_password_matches(stored_password: str, password: str) -> bool:
    if stored_password.startswith("sha256:"):
        expected = stored_password.removeprefix("sha256:")
        actual = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(expected, actual)
    return hmac.compare_digest(stored_password, password)


# ---- 数据库驱动认证 ----

def authenticate_operator(username_or_employee_id: str, password: str) -> OperatorAccount | None:
    """DB 优先，配置降级。"""
    from app.db.session import get_session_factory, get_engine
    from sqlalchemy import inspect as sa_inspect

    username = username_or_employee_id.strip().lower()
    db_found_user = False
    try:
        engine = get_engine()
        insp = sa_inspect(engine)
        has_table = insp.has_table("app_user", schema="identity")
        if has_table:
            SessionLocal = get_session_factory()
            with SessionLocal() as db:
                from app.models.tables import AppUser

                row = db.execute(
                    select(AppUser).where(AppUser.username == username)
                ).scalar_one_or_none()
                if row:
                    db_found_user = True
                    roles = sorted({r.role_code for r in row.roles})
                    role = roles[0] if roles else ""
                    if row.is_active and verify_password(password, row.password_hash):
                        return OperatorAccount(
                            username=row.username,
                            password="",
                            role=role,
                            display_name=row.display_name or row.username,
                        )
    except Exception:
        pass

    # DB 验证已命中用户但密码错误 → 不降级
    if db_found_user:
        return None

    # 降级：传统配置驱动账号
    account = configured_operator_accounts().get(username)
    if account and _legacy_password_matches(account.password, password):
        return account
    return None


# ---- JWT 签发与验证 ----

def issue_session_token(account: OperatorAccount) -> tuple[str, int]:
    """签发标准 JWT。"""
    settings = get_settings()
    now = datetime.now(tz=UTC)
    expires_at = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": account.username,
        "username": account.username,
        "display_name": account.display_name or account.username,
        "roles": [account.role],
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token: str = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, int(expires_at.timestamp())


def format_session_expiry(expires_at: int | None) -> str | None:
    if expires_at is None:
        return None
    return datetime.fromtimestamp(expires_at, UTC).isoformat().replace("+00:00", "Z")


def _session_auth_error(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=401, detail={"code": code, "message": message})


def verify_session_token(token: str) -> OperatorContext:
    """解析 JWT，验证用户仍有效。"""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise _session_auth_error("SESSION_EXPIRED", "登录已过期，请重新登录") from None
    except jwt.InvalidTokenError:
        raise _session_auth_error("SESSION_INVALID", "登录状态无效，请重新登录") from None

    username = str(payload.get("sub") or payload.get("username", ""))
    roles: list[str] = payload.get("roles") or []
    role = roles[0] if roles else ""
    display_name = str(payload.get("display_name") or payload.get("name") or username)
    exp: int = payload.get("exp", 0)
    uid_raw = payload.get("uid")

    if not username or not role:
        raise _session_auth_error("SESSION_INVALID", "令牌载荷无效")

    if role not in ROLE_PERMISSIONS:
        raise _session_auth_error("SESSION_INVALID", "角色无效")

    # 尝试 DB 验证用户仍存在；DB 找不到时降级到配置账号
    db_user_valid = True
    try:
        from app.db.session import get_session_factory, get_engine
        from sqlalchemy import inspect as sa_inspect

        engine = get_engine()
        if sa_inspect(engine).has_table("app_user", schema="identity"):
            SessionLocal = get_session_factory()
            with SessionLocal() as db:
                from app.models.tables import AppUser

                row = db.execute(
                    select(AppUser).where(AppUser.username == username)
                ).scalar_one_or_none()
                if row is None:
                    db_user_valid = False
                elif not row.is_active:
                    raise _session_auth_error("SESSION_INVALID", "用户不存在或已被禁用")
    except HTTPException:
        raise
    except Exception:
        pass

    # 配置降级校验
    if not db_user_valid:
        account = configured_operator_accounts().get(username.lower())
        if account is None or account.role != role:
            raise _session_auth_error("SESSION_INVALID", "用户不存在或已被禁用")

    return OperatorContext(
        name=username,
        role=role,
        display_name=display_name,
        auth_model="operator_password_session",
        session_expires_at=exp,
    )


# ---- 入口鉴权依赖 ----

def verify_api_key(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    x_operator_name: str | None = Header(None, alias="X-Operator-Name"),
    x_operator_role: str | None = Header(None, alias="X-Operator-Role"),
    authorization: str | None = Header(None, alias="Authorization"),
) -> OperatorContext:
    # 优先：Authorization: Bearer <JWT>
    if authorization and authorization.startswith("Bearer "):
        return verify_session_token(authorization.removeprefix("Bearer ").strip())

    # 次优先：X-Session-Token <JWT>
    if x_session_token:
        return verify_session_token(x_session_token)

    # 降级：X-API-Key 传统模式（服务间调用）
    settings = get_settings()
    if not x_api_key or x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="invalid_api_key")
    role = x_operator_role or "platform_admin"
    if role not in ROLE_PERMISSIONS:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": f"unsupported operator role {role}"},
        )
    name = x_operator_name or "service_api_key"
    return OperatorContext(name=name, role=role, display_name=name)
