"""预置主数据种子数据到 mdm schema（空间位置/注册证/UDI/品牌型号/标准设备）。

用法：
    cd src/backend
    python scripts/seed_mdm_data.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datetime import UTC, datetime

from sqlalchemy import text

from app.db.session import get_engine


def _now() -> str:
    return datetime.now(UTC).isoformat()


def seed_mdm_data() -> None:
    engine = get_engine()
    now = _now()

    with engine.begin() as conn:
        existing = conn.execute(text("SELECT count(*) FROM mdm.space_location")).scalar() or 0
        if existing == 0:
            conn.execute(
                text("INSERT INTO mdm.space_location (type, code, name, parent_id, short_name, attributes) "
                     "SELECT 'campus', 'CAMPUS-001', '五莲县人民医院主院区', NULL, '主院区', :a1 "
                     "WHERE NOT EXISTS (SELECT 1 FROM mdm.space_location WHERE code='CAMPUS-001')"),
                {"a1": '{"campusType":"主院区"}'},
            )
            conn.execute(
                text("INSERT INTO mdm.space_location (type, code, name, parent_id, short_name, attributes) "
                     "SELECT 'building', 'BLD-001', '医技楼', id, '医技楼', :a1 "
                     "FROM mdm.space_location WHERE code='CAMPUS-001' "
                     "AND NOT EXISTS (SELECT 1 FROM mdm.space_location WHERE code='BLD-001')"),
                {"a1": '{"buildingType":"医技楼"}'},
            )
            conn.execute(
                text("INSERT INTO mdm.space_location (type, code, name, parent_id, short_name, attributes) "
                     "SELECT 'floor', 'FL-001', '医技楼 1 层', id, '1 层', :a1 "
                     "FROM mdm.space_location WHERE code='BLD-001' "
                     "AND NOT EXISTS (SELECT 1 FROM mdm.space_location WHERE code='FL-001')"),
                {"a1": '{"floorNo":"F01"}'},
            )
            conn.execute(
                text("INSERT INTO mdm.space_location (type, code, name, parent_id, short_name, attributes) "
                     "SELECT 'room', 'ROOM-001', '放射科 DR 室', id, 'DR-101', :a1 "
                     "FROM mdm.space_location WHERE code='FL-001' "
                     "AND NOT EXISTS (SELECT 1 FROM mdm.space_location WHERE code='ROOM-001')"),
                {"a1": '{"roomNo":"DR-101","spaceType":"检查室"}'},
            )
            count = conn.execute(text("SELECT count(*) FROM mdm.space_location")).scalar()
            print(f"  空间位置: {count} 条")

        for table, rows in [
            ("mdm.registration_certificate", [
                ("粤械注准20232070156", "病人监护仪", "病人监护仪", "迈瑞", "BeneVision N15",
                 "深圳迈瑞生物医疗电子股份有限公司", "2028-12-31"),
            ]),
        ]:
            existing = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar() or 0
            if existing == 0:
                for reg, prod, generic, brand, model, holder, valid in rows:
                    conn.execute(
                        text(f"INSERT INTO {table} (registration_no, product_name, generic_name, brand, model, holder_name, valid_to) "
                             "VALUES (:r, :p, :g, :b, :m, :h, :v)"),
                        {"r": reg, "p": prod, "g": generic, "b": brand, "m": model, "h": holder, "v": valid},
                    )
                count = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
                print(f"  {table}: {count} 条")

        for table, rows in [
            ("mdm.udi", [
                ("06900000000001", "BeneVision N15 UDI-DI", "多参数监护仪", "迈瑞", "BeneVision N15", "粤械注准20232070156"),
            ]),
        ]:
            existing = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar() or 0
            if existing == 0:
                for di, prod, generic, brand, model, reg in rows:
                    conn.execute(
                        text(f"INSERT INTO {table} (di, product_name, generic_name, brand, model, registration_no) "
                             "VALUES (:d, :p, :g, :b, :m, :r)"),
                        {"d": di, "p": prod, "g": generic, "b": brand, "m": model, "r": reg},
                    )
                count = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
                print(f"  {table}: {count} 条")

        for table, rows in [
            ("mdm.equipment_brand_model", [
                ("BM-MINDRAY-N15", "迈瑞", "BeneVision N15", "病人监护仪", "病人监护仪",
                 "深圳迈瑞生物医疗电子股份有限公司", "粤械注准20232070156"),
            ]),
        ]:
            existing = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar() or 0
            if existing == 0:
                for code, brand, model, generic, std_name, mfr, reg in rows:
                    conn.execute(
                        text(f"INSERT INTO {table} (code, brand, model, generic_name, standard_name, manufacturer_name, registration_no) "
                             "VALUES (:c, :b, :m, :g, :s, :mfr, :r)"),
                        {"c": code, "b": brand, "m": model, "g": generic, "s": std_name, "mfr": mfr, "r": reg},
                    )
                count = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
                print(f"  {table}: {count} 条")

        for table, rows in [
            ("mdm.standard_equipment", [
                ("STD-EQ-MONITOR", "病人监护仪", "病人监护仪", "18-01", "患者监护设备", "II", "迈瑞", "BeneVision N15"),
            ]),
        ]:
            existing = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar() or 0
            if existing == 0:
                for code, name, generic, cat_code, cat_name, mgmt, brand, model in rows:
                    conn.execute(
                        text(f"INSERT INTO {table} (code, name, generic_name, category_code, category_name, management_class, brand, model) "
                             "VALUES (:c, :n, :g, :cc, :cn, :m, :b, :mo)"),
                        {"c": code, "n": name, "g": generic, "cc": cat_code, "cn": cat_name, "m": mgmt, "b": brand, "mo": model},
                    )
                count = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
                print(f"  {table}: {count} 条")

    print("主数据种子数据写入完成")


if __name__ == "__main__":
    seed_mdm_data()
