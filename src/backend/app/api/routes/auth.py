"""认证 API —— 纯 bcrypt，无配置驱动账号。

历史：
  - OPERATOR_USERS 配置账号已移除（等保合规）
  - /auth/operators 已移除（不暴露用户列表）
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import ApiKeyAuth
from app.api.schemas import ApiEnvelope
from app.core.security import (
    ROLE_PERMISSIONS,
    authenticate_operator,
    format_session_expiry,
    issue_session_token,
)

router = APIRouter()


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


@router.post("/auth/login", response_model=ApiEnvelope)
def login_operator(payload: LoginRequest) -> ApiEnvelope:
    person = authenticate_operator(payload.username, payload.password)
    if person is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "username or password is invalid"},
        )

    session_token, session_expires_at = issue_session_token(person)

    systems = person.get("systems", {})
    all_roles: list[str] = []
    for sys_info in systems.values():
        all_roles.extend(sys_info.get("roles", []))
    permissions = set()
    for r in all_roles:
        permissions.update(ROLE_PERMISSIONS.get(r, set()))

    return ApiEnvelope(
        data={
            "operator_name": person.get("person_code") or person.get("login_account", ""),
            "operator_display_name": person.get("display_name") or person.get("person_name", ""),
            "operator_role": all_roles[0] if all_roles else "",
            "person_id": person.get("person_id", ""),
            "person_name": person.get("person_name", ""),
            "department_name": person.get("department_name", ""),
            "position": person.get("position", ""),
            "systems": systems,
            "permissions": sorted(permissions),
            "auth_model": "unified_person",
            "access_token": session_token,
            "token_type": "bearer",
            "session_token": session_token,
            "session_expires_at": format_session_expiry(session_expires_at),
        }
    )


@router.get("/auth/me", response_model=ApiEnvelope)
def get_current_operator(operator: ApiKeyAuth) -> ApiEnvelope:
    permissions = sorted(ROLE_PERMISSIONS.get(operator.role, set()))
    return ApiEnvelope(
        data={
            "operator_name": operator.name,
            "operator_display_name": operator.display_name or operator.name,
            "operator_role": operator.role,
            "permissions": permissions,
            "auth_model": operator.auth_model,
            "session_expires_at": format_session_expiry(operator.session_expires_at),
        }
    )


@router.get("/auth/permissions", response_model=ApiEnvelope)
def get_permission_matrix() -> ApiEnvelope:
    return ApiEnvelope(
        data={
            "roles": [
                {
                    "role": role,
                    "permissions": sorted(permissions),
                }
                for role, permissions in sorted(ROLE_PERMISSIONS.items())
            ],
            "source": "backend",
        }
    )
