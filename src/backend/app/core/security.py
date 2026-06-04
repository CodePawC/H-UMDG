"""统一身份认证——纯 bcrypt，无明文/无 SHA256 降级路径。

认证链路：
  1. 查询 DictPerson（按 login_account）
  2. bcrypt 验证密码
  3. 规则引擎推导 systems/roles
  4. 签发标准 JWT（载荷含 person_id、systems、roles）
  5. 业务系统验证 JWT 签名后直接读取 roles

降级路径：
  - AppUser 表（bcrypt 存储，过渡兼容）

安全承诺：
  - 不存储明文密码
  - 不使用 SHA256 作为密码哈希
  - 不通过环境变量配置用户账号
  - 所有密码操作统一通过 bcrypt
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from fastapi import Header, HTTPException
from sqlalchemy import select

from app.core.config import get_settings


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
    "ENGINEER": {"dashboard.view", "equipment.manage"},
    "DEPT_USER": {"dashboard.view", "equipment.manage"},
    "DEVICE_ADMIN": {"dashboard.view", "departments.manage", "equipment.manage", "materials.manage"},
    "FINANCE_READ": {"dashboard.view"},
    "SUPPLIER": set(),
    # 旧角色名兼容（等保迁移过渡期保留）
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
    person_code = (person.person_code or person.login_account or person.person_name or "").strip()
    return {
        "person_id": str(person.person_id),
        "person_code": person_code,
        "login_account": person.login_account or "",
        "person_name": person.person_name or "",
        "position": person.position or "",
        "department_name": dept_name or "",
        "person_type": person.person_type or "",
        "employment_status": person.employment_status or "ACTIVE",
    }


def authenticate_person(username: str, password: str) -> dict[str, Any] | None:
    """纯 bcrypt 认证，无明文/无 SHA256 降级路径。

    DictPerson 认证路径 → 返回人员 dict（含 systems）。
    AppUser 降级路径 → 转为 dict 格式返回。
    """
    from app.db.session import get_session_factory
    from app.services.access_rules import derive_person_systems

    username = username.strip().lower()

    # 1. DictPerson 认证（主路径）
    try:
        SessionLocal = get_session_factory()
        with SessionLocal() as db:
            from app.models.tables import DictPerson

            person = db.execute(
                select(DictPerson).where(DictPerson.login_account == username)
            ).scalar_one_or_none()

            if person and person.password_hash:
                if person.employment_status not in ("ACTIVE",):
                    return None
                if verify_password(password, person.password_hash):
                    person_dict = _person_to_dict(person)
                    person_dict["systems"] = derive_person_systems(person_dict)
                    person_dict["display_name"] = person.person_name
                    return person_dict
                return None
    except Exception:
        pass

    # 2. AppUser 降级路径
    try:
        SessionLocal = get_session_factory()
        with SessionLocal() as db:
            from app.models.tables import AppUser

            row = db.execute(
                select(AppUser).where(AppUser.username == username)
            ).scalar_one_or_none()
            if row:
                if not row.is_active:
                    return None
                if not verify_password(password, row.password_hash):
                    return None
                roles = sorted({r.role_code for r in row.roles})
                return {
                    "person_id": str(row.id),
                    "login_account": row.username,
                    "person_code": row.username,
                    "person_name": row.display_name or row.username,
                    "display_name": row.display_name or row.username,
                    "systems": {},
                }
    except Exception:
        pass

    return None


def authenticate_operator(username_or_employee_id: str, password: str) -> dict[str, Any] | None:
    """统一登录入口。返回人员 dict（含 systems）。"""
    return authenticate_person(username_or_employee_id, password)


# ---- JWT 签发 ----

def issue_session_token(person: dict[str, Any]) -> tuple[str, int]:
    """签发标准 JWT。"""
    settings = get_settings()
    now = datetime.now(tz=UTC)
    expires_at = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

    sys_info = person.get("systems", {})
    payload: dict[str, Any] = {
        "sub": person.get("person_id") or person.get("login_account", ""),
        "person_id": person.get("person_id", ""),
        "username": (person.get("person_code") or person.get("login_account", "") or "").strip(),
        "display_name": person.get("display_name") or person.get("person_name", ""),
        "department_name": person.get("department_name", ""),
        "position": person.get("position", ""),
        "systems": sys_info,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    umdg_roles = sys_info.get("H-UMDG", {}).get("roles", [])
    if umdg_roles:
        payload["roles"] = umdg_roles
        payload["role"] = umdg_roles[0]
    else:
        payload["roles"] = []
        payload["role"] = ""

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

    if not username:
        raise _session_auth_error("SESSION_INVALID", "令牌载荷无效")

    if role not in ROLE_PERMISSIONS:
        raise _session_auth_error("SESSION_INVALID", "角色无效")

    return OperatorContext(
        name=username,
        role=role,
        display_name=display_name,
        auth_model="operator_password_session",
        session_expires_at=exp,
        person_id=person_id,
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
