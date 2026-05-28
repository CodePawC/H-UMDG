from fastapi import APIRouter

from app.api.routes import (
    auth,
    departments,
    dictionaries,
    equipment,
    exchange,
    import_tasks,
    manufacturer_vendors,
    mapping,
    materials,
    master_data,
    organization,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(dictionaries.router, tags=["dictionaries"])
api_router.include_router(organization.router, tags=["organization-master"])
api_router.include_router(departments.router, tags=["departments"])
api_router.include_router(materials.router, tags=["materials"])
api_router.include_router(equipment.router, tags=["equipment"])
api_router.include_router(master_data.router, tags=["master-data-external"])
api_router.include_router(manufacturer_vendors.router, tags=["manufacturer-vendors"])
api_router.include_router(import_tasks.router, tags=["import-tasks"])
api_router.include_router(mapping.router, tags=["mapping"])
api_router.include_router(exchange.router, tags=["exchange"])
