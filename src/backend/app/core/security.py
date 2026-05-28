from dataclasses import dataclass
import base64
from datetime import datetime, timezone
import hashlib
import hmac
import json
import time

from fastapi import Header, HTTPException

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


def _decode_base64url(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _encode_base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _session_signature(payload: str) -> str:
    settings = get_settings()
    return hmac.new(settings.api_key.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).hexdigest()


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


def _password_matches(stored_password: str, password: str) -> bool:
    if stored_password.startswith("sha256:"):
        expected = stored_password.removeprefix("sha256:")
        actual = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(expected, actual)
    return hmac.compare_digest(stored_password, password)


def authenticate_operator(username_or_employee_id: str, password: str) -> OperatorAccount | None:
    username = username_or_employee_id.strip().lower()
    account = configured_operator_accounts().get(username)
    if account is None:
        return None
    if not _password_matches(account.password, password):
        return None
    return account


def format_session_expiry(expires_at: int | None) -> str | None:
    if expires_at is None:
        return None
    return datetime.fromtimestamp(expires_at, timezone.utc).isoformat().replace("+00:00", "Z")


def issue_session_token(account: OperatorAccount) -> tuple[str, int]:
    settings = get_settings()
    expires_at = int(time.time()) + settings.operator_session_ttl_minutes * 60
    payload = {
        "sub": account.username,
        "name": account.display_name,
        "role": account.role,
        "exp": expires_at,
    }
    encoded_payload = _encode_base64url(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    )
    return f"{encoded_payload}.{_session_signature(encoded_payload)}", expires_at


def _session_auth_error(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=401, detail={"code": code, "message": message})


def verify_session_token(token: str) -> OperatorContext:
    try:
        encoded_payload, signature = token.split(".", 1)
        expected_signature = _session_signature(encoded_payload)
        if not hmac.compare_digest(signature, expected_signature):
            raise ValueError("invalid signature")
        payload = json.loads(_decode_base64url(encoded_payload))
        username = str(payload["sub"])
        role = str(payload["role"])
        exp = int(payload["exp"])
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        raise _session_auth_error("SESSION_INVALID", "登录状态无效，请重新登录") from None

    if exp < int(time.time()):
        raise _session_auth_error("SESSION_EXPIRED", "登录已过期，请重新登录")

    account = configured_operator_accounts().get(username.lower())
    if account is None or account.role != role or role not in ROLE_PERMISSIONS:
        raise _session_auth_error("SESSION_INVALID", "登录状态无效，请重新登录")

    return OperatorContext(
        name=account.username,
        role=account.role,
        display_name=account.display_name,
        auth_model="operator_password_session",
        session_expires_at=exp,
    )


def verify_api_key(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    x_session_token: str | None = Header(None, alias="X-Session-Token"),
    x_operator_name: str | None = Header(None, alias="X-Operator-Name"),
    x_operator_role: str | None = Header(None, alias="X-Operator-Role"),
) -> OperatorContext:
    if x_session_token:
        return verify_session_token(x_session_token)

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
