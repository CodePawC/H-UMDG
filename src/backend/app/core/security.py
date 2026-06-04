"""统一身份认证——DictPerson 主数据驱动。

核心理念：
  系统权限不是"分配"给人的，而是人员的岗位/科室属性天生携带的。
  登录时从 DictPerson 查询人员，通过 access_rules 规则引擎
  自动推导可访问的系统列表和角色。

认证链路：
  1. 查询 DictPerson（按 login_account）
  2. bcrypt 验证密码
  3. 规则引擎推导 systems/roles
  4. 签发标准 JWT（载荷含 person_id、systems、roles）
  5. 业务系统验证 JWT 签名后直接读取 roles

向后兼容：
  - AppUser 表仍可用作降级登录（旧账号体系）
  - OPERATOR_USERS 配置账号仍可用（开发环境）
"""

from dataclasses import dataclass, field
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
    person_id: str | None = None
    systems: dict[str, dict[str, list[str]]] = field(default_factory=dict)

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
    "AUDIT_ADMIN": {"dashboard.view", "exchange.view", "raw_payload.view"},
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
    "ENGINEER": {"dashboard.view", "equipment.manage"},
    "DEPT_USER": {"dashboard.view", "equipment.manage"},
    "DEVICE_ADMIN": {"dashboard.view", "departments.manage", "equipment.manage", "materials.manage"},
    "FINANCE_READ": {"dashboard.view"},
    "SUPPLIER": set(),
}


# ---- bcrypt 工具 ----

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---- 配置驱动账号（降级） ----

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


# ---- DictPerson 驱动认证 ----

def _person_to_dict(person) -> dict[str, Any]:
    """将 DictPerson ORM 对象转为规则引擎可用的 dict。"""
    from app.models.tables import DictPerson

    dept_name = None
    if person.department_id:
        try:
            from app.db.session import get_session_factory

            SessionLocal = get_session_factory()
            with SessionLocal() as db:
                from app.models.tables import DictDepartment

                dept = db.get(DictDepartment, person.department_id)
                if dept:
                    dept_name = dept.dept_name
        except Exception:
            pass
    return {
        "person_id": str(person.person_id),
        "person_code": person.person_code or "",
        "login_account": person.login_account or "",
        "person_name": person.person_name or "",
        "position": person.position or "",
        "department_name": dept_name or "",
        "person_type": person.person_type or "",
        "employment_status": person.employment_status or "ACTIVE",
    }


def authenticate_person(username: str, password: str) -> OperatorAccount | dict[str, Any] | None:
    """DictPerson 认证，返回人员 dict（含 systems/roles）。

    auth_model=unified 时，返回的人员 dict 包含 systems 字段。
    auth_model=legacy 时，返回 OperatorAccount。
    """
    from app.db.session import get_session_factory
    from app.services.access_rules import derive_person_systems

    username = username.strip().lower()

    # 1. 尝试 DictPerson 认证（统一身份主路径）
    try:
        SessionLocal = get_session_factory()
        with SessionLocal() as db:
            from app.models.tables import DictPerson

            person = db.execute(
                select(DictPerson).where(DictPerson.login_account == username)
            ).scalar_one_or_none()

            if person and person.password_hash:
                if person.employment_status not in ("ACTIVE",):
                    return None  # 离职/退休人员拒绝登录
                if verify_password(password, person.password_hash):
                    person_dict = _person_to_dict(person)
                    person_dict["systems"] = derive_person_systems(person_dict)
                    person_dict["display_name"] = person.person_name
                    return person_dict
                return None  # 密码错误
    except Exception:
        pass

    # 2. 降级：AppUser 表（过渡兼容）
    try:
        SessionLocal = get_session_factory()
        with SessionLocal() as db:
            from app.models.tables import AppUser

            row = db.execute(
                select(AppUser).where(AppUser.username == username)
            ).scalar_one_or_none()
            if row:
                roles = sorted({r.role_code for r in row.roles})
                role = roles[0] if roles else ""
                if row.is_active and verify_password(password, row.password_hash):
                    return OperatorAccount(
                        username=row.username,
                        password="",
                        role=role,
                        display_name=row.display_name or row.username,
                    )
                return None  # AppUser 密码错误
    except Exception:
        pass

    # 3. 最低降级：配置驱动账号
    account = configured_operator_accounts().get(username)
    if account and _legacy_password_matches(account.password, password):
        return account
    return None


def authenticate_operator(username_or_employee_id: str, password: str) -> OperatorAccount | dict[str, Any] | None:
    """统一登录入口。返回 OperatorAccount 或人员 dict（含 systems）。"""
    return authenticate_person(username_or_employee_id, password)


# ---- JWT 签发 ----

def issue_session_token(account_or_person: OperatorAccount | dict[str, Any]) -> tuple[str, int]:
    """签发标准 JWT。统一身份模式下 payload 含 systems/roles。"""
    settings = get_settings()
    now = datetime.now(tz=UTC)
    expires_at = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

    if isinstance(account_or_person, dict):
        # 统一身份模式：来自 DictPerson
        sys_info = account_or_person.get("systems", {})
        payload: dict[str, Any] = {
            "sub": account_or_person.get("person_id") or account_or_person.get("login_account", ""),
            "person_id": account_or_person.get("person_id", ""),
            "username": account_or_person.get("person_code") or account_or_person.get("login_account", ""),
            "display_name": account_or_person.get("display_name") or account_or_person.get("person_name", ""),
            "department_name": account_or_person.get("department_name", ""),
            "position": account_or_person.get("position", ""),
            "systems": sys_info,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
        }
        # 为了向后兼容，设置 roles 为 H-UMDG 角色
        umdg_roles = sys_info.get("H-UMDG", {}).get("roles", [])
        if umdg_roles:
            payload["roles"] = umdg_roles
            payload["role"] = umdg_roles[0]
        else:
            payload["roles"] = []
            payload["role"] = ""
    else:
        # 传统模式：来自 OperatorAccount 或 AppUser
        payload = {
            "sub": account_or_person.username,
            "username": account_or_person.username,
            "display_name": account_or_person.display_name,
            "roles": [account_or_person.role],
            "systems": {},
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
    """解析 JWT，验证用户有效性。"""
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
    person_id = payload.get("person_id") or ""
    systems = payload.get("systems") or {}

    if not username:
        raise _session_auth_error("SESSION_INVALID", "令牌载荷无效")

    # 尝试验证人员状态
    try:
        from app.db.session import get_session_factory, get_engine
        from sqlalchemy import inspect as sa_inspect

        engine = get_engine()
        if sa_inspect(engine).has_table("dict_persons", schema=None):
            SessionLocal = get_session_factory()
            with SessionLocal() as db:
                from app.models.tables import DictPerson

                row = db.execute(
                    select(DictPerson).where(DictPerson.person_id == person_id)
                ).scalar_one_or_none() if person_id else None

                if row:
                    if row.employment_status not in ("ACTIVE",):
                        raise _session_auth_error("SESSION_INVALID", "用户状态异常，请联系管理员")
                    role = roles[0] if roles else ""
                    display_name = row.person_name or display_name
                else:
                    # 通过 username 查（降级兼容）
                    if person_id:
                        pass  # person_id 指定的人员在 DictPerson 中已不存在
    except HTTPException:
        raise
    except Exception:
        pass

    return OperatorContext(
        name=username,
        role=role,
        display_name=display_name,
        auth_model="operator_password_session",
        session_expires_at=exp,
        person_id=person_id,
        systems=systems,
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
