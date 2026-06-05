from urllib.parse import urlparse, urlunparse

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.routes.equipment import external_router as equipment_external_router
from app.api.routes.manufacturer_vendors import external_router as manufacturer_vendor_external_router
from app.api.router import api_router
from app.core.config import get_settings
from app.db.session import get_engine


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

    class _SecurityHeadersMiddleware(BaseHTTPMiddleware):
        """生产安全响应头（等保合规）。"""
        async def dispatch(self, request, call_next):
            response = await call_next(request)
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
                "connect-src 'self' ws: wss:; font-src 'self' data:; frame-ancestors 'none'"
            )
            return response

    app.add_middleware(_SecurityHeadersMiddleware)

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

    @app.get("/health/ready")
    def health_ready() -> JSONResponse:
        checks: dict[str, str] = {}
        ok = True

        try:
            from sqlalchemy import text

            engine = get_engine()
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            checks["database"] = "ok"
            checks["alembic_version"] = _probe_alembic_revision(engine)
        except Exception as exc:
            checks["database"] = f"error:{exc!s}"[:200]
            ok = False

        payload = {
            "status": "ready" if ok else "not_ready",
            "checks": checks,
            "database_url": _sanitize_database_url(settings.database_url),
        }
        code = status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE
        return JSONResponse(status_code=code, content=payload)

    return app


app = create_app()


def _sanitize_database_url(database_url: str) -> str:
    if "@" not in database_url or database_url.startswith("sqlite"):
        return database_url
    try:
        parsed = urlparse(database_url)
        if not parsed.password:
            return database_url
        netloc = f"{parsed.username}:***@{parsed.hostname}"
        if parsed.port:
            netloc += f":{parsed.port}"
        return urlunparse((parsed.scheme, netloc, parsed.path or "", "", parsed.query or "", ""))
    except ValueError:
        return "<invalid database_url>"


def _probe_alembic_revision(engine) -> str:
    if engine.dialect.name != "postgresql":
        return "n/a"
    try:
        from sqlalchemy import text

        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1")
            ).fetchone()
        return row[0] if row else "empty"
    except Exception:
        return "unavailable"


def run_dev() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8101, reload=True)
