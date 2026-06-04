"""恢复 NHSA 样本数据和医疗器械分类目录到数据库。

用法：
    cd src/backend
    python scripts/restore_sample_data.py

说明：
    - NHSA 医保耗材样本从 xlsx 恢复（已在仓库中）
    - 医疗器械分类目录需要 docx 源文件，不在仓库中
      如有请放入 data/samples/external/nmpa/医疗器械分类目录.docx
    - 幂等，已有数据时跳过
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import get_session_factory, get_engine
from app.services.import_pipeline import (
    import_nhsa_full_spec,
    import_nhsa_disabled,
    import_nhsa_transcode,
    import_device_classification_docx,
)
from sqlalchemy import text


SAMPLES = Path("../../data/samples").resolve()


def restore() -> None:
    engine = get_engine()
    with engine.connect() as c:
        existing = c.execute(text("SELECT count(*) FROM dict_material_specs")).scalar() or 0
        existing_cat = c.execute(text("SELECT count(*) FROM ref_device_classification_catalog")).scalar() or 0

    print(f"当前: dict_material_specs={existing} 条, ref_device_classification_catalog={existing_cat} 条")

    SessionLocal = get_session_factory()

    if existing == 0:
        for fname, importer, batch_id, extra in [
            ("external/nhsa/H-UMDG-SAMPLE-NHSA-C09-FULL-SPEC-v1.0.xlsx", import_nhsa_full_spec, "SAMPLE-FULL-001", {"sheet_name": "Query1"}),
            ("external/nhsa/H-UMDG-SAMPLE-NHSA-DISABLED-v1.0.xlsx", import_nhsa_disabled, "SAMPLE-DISABLED-001", {"sheet_name": "Query1"}),
            ("external/nhsa/H-UMDG-SAMPLE-NHSA-TRANSCODE-v1.0.xlsx", import_nhsa_transcode, "SAMPLE-TRANSCODE-001", {"sheet_name": "Query1"}),
        ]:
            with SessionLocal() as db:
                path = SAMPLES / fname
                print(f"导入 {path.name}...")
                content = path.read_bytes()
                r = importer(db, content, path.name, extra.get("sheet_name"), batch_id)
                print(f"  成功: {r['success_count']}, 失败: {r['failed_count']}")
                db.commit()
    else:
        print("医保耗材数据已存在，跳过导入")

    if existing_cat == 0:
        docx_path = SAMPLES / "external/nmpa/医疗器械分类目录.docx"
        if docx_path.exists():
            with SessionLocal() as db:
                print(f"导入 {docx_path.name}...")
                content = docx_path.read_bytes()
                r = import_device_classification_docx(db, content, docx_path.name, "SAMPLE-CATALOG-001")
                print(f"  成功: {r['success_count']}, 失败: {r['failed_count']}")
                db.commit()
        else:
            print(f"分类目录文件不存在: {docx_path}，跳过")
    else:
        print("分类目录已存在，跳过")

    with engine.connect() as c:
        final_ms = c.execute(text("SELECT count(*) FROM dict_material_specs")).scalar()
        final_cat = c.execute(text("SELECT count(*) FROM ref_device_classification_catalog")).scalar()
    print(f"\n恢复后: dict_material_specs={final_ms} 条, ref_device_classification_catalog={final_cat} 条")


if __name__ == "__main__":
    restore()
