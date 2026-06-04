"""预置初始管理员到 dict_persons 表（统一身份主路径）。

用法：
    cd src/backend
    python scripts/seed_admin.py                  # admin / admin123
    python scripts/seed_admin.py myuser mypass    # 自定义

同时也会同步创建 identity.app_user 记录作为降级兼容。
"""

import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bcrypt
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_engine


def seed_admin(username: str = "admin", password: str = "admin123", display_name: str = "系统管理员") -> None:
    engine = get_engine()

    # 检查 dict_persons 表是否存在
    with engine.connect() as conn:
        has_person_table = conn.execute(
            text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dict_persons')")
        ).scalar()
        has_identity_table = conn.execute(
            text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'identity' AND table_name = 'app_user')")
        ).scalar()

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")

    # 1. 写入 dict_persons（统一身份主路径）
    if has_person_table:
        with engine.begin() as conn:
            existing = conn.execute(
                text("SELECT person_id FROM dict_persons WHERE login_account = :u"),
                {"u": username},
            ).fetchone()
            if existing:
                print(f"人员 '{username}' 已存在（dict_persons），更新密码和信息")
                conn.execute(
                    text("UPDATE dict_persons SET password_hash = :p, person_code = :c, person_name = :n WHERE login_account = :u"),
                    {"p": pw_hash, "c": username, "n": display_name, "u": username},
                )
            else:
                pid = str(uuid.uuid4())
                conn.execute(
                    text(
                        "INSERT INTO dict_persons (person_id, person_code, person_name, login_account, password_hash, "
                        "position, employment_status, status) "
                        "VALUES (:id, :code, :name, :login, :pw, :pos, 'ACTIVE', 'ACTIVE')"
                    ),
                    {
                        "id": pid,
                        "code": username,
                        "name": display_name,
                        "login": username,
                        "pw": pw_hash,
                        "pos": "系统管理员",
                    },
                )
                print(f"人员 '{username}' 创建成功（dict_persons）")

    # 2. 同步写入 identity.app_user（降级兼容）
    if has_identity_table:
        with engine.begin() as conn:
            existing = conn.execute(
                text("SELECT id FROM identity.app_user WHERE username = :u"),
                {"u": username},
            ).fetchone()
            if existing:
                conn.execute(
                    text("UPDATE identity.app_user SET password_hash = :p WHERE username = :u"),
                    {"p": pw_hash, "u": username},
                )
                print(f"账号 '{username}' 更新密码（identity.app_user）")
            else:
                uid = str(uuid.uuid4())
                conn.execute(
                    text(
                        "INSERT INTO identity.app_user (id, username, password_hash, display_name, is_active) "
                        "VALUES (:id, :u, :p, :d, true)"
                    ),
                    {"id": uid, "u": username, "p": pw_hash, "d": display_name},
                )
                for role in ["SYS_ADMIN", "AUDIT_ADMIN"]:
                    conn.execute(
                        text("INSERT INTO identity.user_role (user_id, role_code) VALUES (:uid, :role)"),
                        {"uid": uid, "role": role},
                    )
                print(f"账号 '{username}' 创建成功（identity.app_user，角色: SYS_ADMIN, AUDIT_ADMIN）")

    print(f"\n用户 '{username}' 就绪。登录账号同用户名，密码为 {password}")


if __name__ == "__main__":
    args = sys.argv[1:]
    username = args[0] if len(args) >= 1 else "admin"
    password = args[1] if len(args) >= 2 else "admin123"
    seed_admin(username, password)
