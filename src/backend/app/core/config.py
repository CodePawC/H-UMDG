from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "H-UMDG"
    app_display_name: str = "医院统一主数据治理平台"
    app_env: str = "development"
    server_port: int = 8101
    frontend_port: int = 5101
    upload_dir: str = "./storage/uploads"
    log_dir: str = "./storage/logs"
    backup_dir: str = "./storage/backups"

    database_url: str = "postgresql+psycopg://umdg:umdg@localhost:5432/umdg"
    redis_url: str = "redis://localhost:6379/0"
    api_key: str = "change-me"
    operator_session_ttl_minutes: int = 480
    operator_users: str = (
        "admin|admin123|platform_admin|平台管理员;"
        "E1001|demo123|data_steward|数据治理员;"
        "AUD001|audit123|auditor|审计员"
    )
    log_level: str = "INFO"
    cors_origins: str = "http://127.0.0.1:5101,http://localhost:5101"

    # JWT（企业级，推荐与 H-MELC 同密钥以实现单点登录）
    jwt_secret_key: str = "dev-jwt-secret-change-me-in-production-min-32-chars!!"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480

    umdg_repo_root: Path | None = None
    umdg_nhsa_dir: Path | None = None
    umdg_device_catalog_docx: Path | None = None
    umdg_import_spool_dir: Path | None = None
    umdg_equipment_source_dir: Path | None = None
    umdg_import_max_upload_bytes: int | None = None
    umdg_import_max_archive_entries: int | None = None
    umdg_import_max_archive_uncompressed_bytes: int | None = None
    umdg_import_cleanup_spool_on_finish: bool | None = None

    # Legacy H-UDMP environment names are kept for old local scripts and fixtures.
    hudmp_repo_root: Path = Path(".")
    hudmp_nhsa_dir: Path | None = None
    hudmp_device_catalog_docx: Path | None = None
    hudmp_import_spool_dir: Path = Path("./runtime/import-spool")
    hudmp_equipment_source_dir: Path = Path("./runtime/equipment-source-files")
    hudmp_import_max_upload_bytes: int = 1024 * 1024 * 1024
    hudmp_import_max_archive_entries: int = 200
    hudmp_import_max_archive_uncompressed_bytes: int = 4 * 1024 * 1024 * 1024
    hudmp_import_cleanup_spool_on_finish: bool = True

    api_version_label: str = "mvp-v1"

    def allowed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def resolved_nhsa_dir(self) -> Path:
        if self.umdg_nhsa_dir is not None:
            return Path(self.umdg_nhsa_dir).expanduser()
        if self.hudmp_nhsa_dir is not None:
            return Path(self.hudmp_nhsa_dir).expanduser()
        return (self.repo_root() / "data/samples/external/nhsa").resolve()

    def resolved_device_catalog_docx(self) -> Path:
        if self.umdg_device_catalog_docx is not None:
            return Path(self.umdg_device_catalog_docx).expanduser()
        if self.hudmp_device_catalog_docx is not None:
            return Path(self.hudmp_device_catalog_docx).expanduser()
        return (self.repo_root() / "data/samples/external/nmpa/医疗器械分类目录.docx").resolve()

    def resolved_import_spool_dir(self) -> Path:
        return Path(self.umdg_import_spool_dir or self.hudmp_import_spool_dir).expanduser().resolve()

    def resolved_equipment_source_dir(self) -> Path:
        return Path(self.umdg_equipment_source_dir or self.hudmp_equipment_source_dir).expanduser().resolve()

    def repo_root(self) -> Path:
        return Path(self.umdg_repo_root or self.hudmp_repo_root).expanduser()

    @property
    def effective_import_max_upload_bytes(self) -> int:
        return self.umdg_import_max_upload_bytes or self.hudmp_import_max_upload_bytes

    @property
    def effective_import_max_archive_entries(self) -> int:
        return self.umdg_import_max_archive_entries or self.hudmp_import_max_archive_entries

    @property
    def effective_import_max_archive_uncompressed_bytes(self) -> int:
        return self.umdg_import_max_archive_uncompressed_bytes or self.hudmp_import_max_archive_uncompressed_bytes

    @property
    def effective_import_cleanup_spool_on_finish(self) -> bool:
        if self.umdg_import_cleanup_spool_on_finish is not None:
            return self.umdg_import_cleanup_spool_on_finish
        return self.hudmp_import_cleanup_spool_on_finish


@lru_cache
def get_settings() -> Settings:
    return Settings()
