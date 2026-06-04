from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import ApiKeyAuth, PermissionsManageAuth
from app.api.schemas import ApiEnvelope
from app.core.security import (
    ROLE_PERMISSIONS,
    authenticate_operator,
    configured_operator_accounts,
    format_session_expiry,
    issue_session_token,
)

router = APIRouter()


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


@router.post("/auth/login", response_model=ApiEnvelope)
def login_operator(payload: LoginRequest) -> ApiEnvelope:
    account = authenticate_operator(payload.username, payload.password)
    if account is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "username or password is invalid"},
        )

    session_token, session_expires_at = issue_session_token(account)

    if isinstance(account, dict):
        # 统一身份模式：来自 DictPerson
        systems = account.get("systems", {})
        all_roles: list[str] = []
        for sys_info in systems.values():
            all_roles.extend(sys_info.get("roles", []))
        permissions = set()
        for r in all_roles:
            permissions.update(ROLE_PERMISSIONS.get(r, set()))
        return ApiEnvelope(
            data={
                "operator_name": account.get("person_code") or account.get("login_account", ""),
                "operator_display_name": account.get("display_name") or account.get("person_name", ""),
                "operator_role": all_roles[0] if all_roles else "",
                "person_id": account.get("person_id", ""),
                "person_name": account.get("person_name", ""),
                "department_name": account.get("department_name", ""),
                "position": account.get("position", ""),
                "systems": systems,
                "permissions": sorted(permissions),
                "auth_model": "unified_person",
                "access_token": session_token,
                "token_type": "bearer",
                "session_token": session_token,
                "session_expires_at": format_session_expiry(session_expires_at),
            }
        )

    # 传统模式：OperatorAccount
    permissions = sorted(ROLE_PERMISSIONS.get(account.role, set()))
    return ApiEnvelope(
        data={
            "operator_name": account.username,
            "operator_display_name": account.display_name,
            "operator_role": account.role,
            "permissions": permissions,
            "auth_model": "operator_password_session",
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
def get_permission_matrix(_: PermissionsManageAuth) -> ApiEnvelope:
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


@router.get("/auth/operators", response_model=ApiEnvelope)
def get_operator_accounts(_: PermissionsManageAuth) -> ApiEnvelope:
    return ApiEnvelope(
        data={
            "accounts": [
                {
                    "username": account.username,
                    "display_name": account.display_name,
                    "role": account.role,
                    "permissions": sorted(ROLE_PERMISSIONS.get(account.role, set())),
                    "password_type": "sha256" if account.password.startswith("sha256:") else "configured",
                }
                for account in sorted(configured_operator_accounts().values(), key=lambda item: item.username.lower())
            ],
            "source": "backend",
        }
    )
