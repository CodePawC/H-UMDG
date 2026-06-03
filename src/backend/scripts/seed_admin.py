"""预置初始管理员账号到 identity.app_user 表。

用法：
    cd src/backend
    python scripts/seed_admin.py              # admin / admin123
    python scripts/seed_admin.py myuser mypass  # 自定义
"""

import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bcrypt
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_engine


def seed_admin(username: str = "admin", password: str = "admin123") -> None:
    engine = get_engine()

    with engine.connect() as conn:
        has_table = conn.execute(
            text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'identity' AND table_name = 'app_user')")
        ).scalar()
    if not has_table:
        print("identity.app_user 表不存在，请先执行 alembic upgrade head")
        return

    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id FROM identity.app_user WHERE username = :u"),
            {"u": username},
        ).fetchone()
        if existing:
            print(f"用户 '{username}' 已存在，跳过")
            return

        uid = uuid.uuid4()
        pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")
        conn.execute(
            text(
                "INSERT INTO identity.app_user (id, username, password_hash, display_name, is_active) "
                "VALUES (:id, :u, :p, :d, true)"
            ),
            {"id": uid, "u": username, "p": pw_hash, "d": f"{username}(预置管理员)"},
        )
        for role in ["SYS_ADMIN", "AUDIT_ADMIN"]:
            conn.execute(
                text("INSERT INTO identity.user_role (user_id, role_code) VALUES (:uid, :role)"),
                {"uid": uid, "role": role},
            )
        print(f"用户 '{username}' 创建成功（角色: SYS_ADMIN, AUDIT_ADMIN）")


if __name__ == "__main__":
    args = sys.argv[1:]
    username = args[0] if len(args) >= 1 else "admin"
    password = args[1] if len(args) >= 2 else "admin123"
    seed_admin(username, password)
