from typing import Annotated, Callable

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.security import OperatorContext, ROLE_PERMISSIONS, verify_api_key
from app.db.session import get_db

DbSession = Annotated[Session, Depends(get_db)]
ApiKeyAuth = Annotated[OperatorContext, Depends(verify_api_key)]


def require_permission(permission: str) -> Callable[[OperatorContext], OperatorContext]:
    def dependency(operator: OperatorContext = Depends(verify_api_key)) -> OperatorContext:
        if permission not in ROLE_PERMISSIONS.get(operator.role, set()):
            from fastapi import HTTPException

            raise HTTPException(
                status_code=403,
                detail={
                    "code": "FORBIDDEN",
                    "message": f"operator role {operator.role} does not have permission {permission}",
                },
            )
        return operator

    return dependency


DepartmentManageAuth = Annotated[OperatorContext, Depends(require_permission("departments.manage"))]
OrganizationManageAuth = Annotated[OperatorContext, Depends(require_permission("departments.manage"))]
MaterialManageAuth = Annotated[OperatorContext, Depends(require_permission("materials.manage"))]
EquipmentManageAuth = Annotated[OperatorContext, Depends(require_permission("equipment.manage"))]
VendorManageAuth = Annotated[OperatorContext, Depends(require_permission("vendors.manage"))]
ImportManageAuth = Annotated[OperatorContext, Depends(require_permission("imports.manage"))]
MappingReviewAuth = Annotated[OperatorContext, Depends(require_permission("mapping.review"))]
ExchangeViewAuth = Annotated[OperatorContext, Depends(require_permission("exchange.view"))]
