from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.equipment import external_router as equipment_external_router
from app.api.routes.manufacturer_vendors import external_router as manufacturer_vendor_external_router
from app.api.router import api_router
from app.core.config import get_settings


def _error_payload(code: str, message: str, trace_id: str | None = None) -> dict[str, str | bool | None]:
    return {"success": False, "code": code, "message": message, "data": None, "trace_id": trace_id}


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="H-UMDG 医院统一主数据治理平台 API",
        version=settings.api_version_label,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    cors_origins = settings.allowed_cors_origins()
    if cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
            allow_headers=[
                "X-API-Key",
                "X-Session-Token",
                "X-Operator-Name",
                "X-Operator-Role",
                "X-Request-ID",
                "Authorization",
                "Content-Type",
            ],
        )
    app.include_router(api_router)
    app.include_router(equipment_external_router, tags=["external-equipment"])
    app.include_router(manufacturer_vendor_external_router, tags=["external-manufacturer-vendors"])

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        trace_id = request.headers.get("X-Request-ID")
        detail = exc.detail
        if isinstance(detail, dict):
            code = str(detail.get("code") or "HTTP_ERROR")
            message = str(detail.get("message") or code)
        elif detail == "invalid_api_key":
            code = "UNAUTHORIZED"
            message = "API Key invalid or missing"
        else:
            code = "HTTP_ERROR"
            message = str(detail)
        return JSONResponse(status_code=exc.status_code, content=_error_payload(code, message, trace_id))

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        trace_id = request.headers.get("X-Request-ID")
        return JSONResponse(
            status_code=400,
            content=_error_payload("VALIDATION_FAILED", "Request validation failed", trace_id)
            | {"details": exc.errors()},
        )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "h-umdg-backend", "version": settings.api_version_label}

    return app


app = create_app()


def run_dev() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8101, reload=True)
