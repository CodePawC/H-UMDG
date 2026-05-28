"""Built-in standard department library based on national diagnosis subjects."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tables import DictDepartment

STANDARD_DEPARTMENT_VERSION = "STANDARD-DEPARTMENTS-2026.05"
STANDARD_DEPARTMENT_SOURCE = "国家卫生健康委《医疗机构诊疗科目名录》"


@dataclass(frozen=True)
class StandardDepartment:
    code: str
    name: str
    dept_type: str
    parent_code: str | None = None
    aliases: tuple[str, ...] = ()

    @property
    def scope(self) -> str:
        if "检验" in self.name:
            return f"提供{self.name}相关检验、结果审核、报告发布和质量控制。"
        if "影像" in self.name or self.name in {"X线诊断专业", "CT诊断专业", "磁共振成像诊断专业", "超声诊断专业"}:
            return f"提供{self.name}相关检查、诊断报告、会诊支持和影像质量管理。"
        if "病理" in self.name:
            return "承担组织、细胞及分子病理诊断，支撑临床诊疗和肿瘤规范化管理。"
        if "保健" in self.name:
            return f"承担{self.name}相关筛查、评估、健康指导、随访和预防保健服务。"
        if self.dept_type == "诊疗科目":
            return f"作为{self.name}一级诊疗科目，用于标准科室启停、院内科室映射和统计口径统一。"
        return f"承担{self.name}相关疾病的诊断、治疗、随访、会诊和质量管理。"


def _dept(
    code: str,
    name: str,
    dept_type: str,
    parent_code: str | None = None,
    aliases: tuple[str, ...] = (),
) -> StandardDepartment:
    return StandardDepartment(
        code=f"NHC-{code}",
        name=name,
        dept_type=dept_type,
        parent_code=f"NHC-{parent_code}" if parent_code else None,
        aliases=aliases,
    )


STANDARD_DEPARTMENTS: tuple[StandardDepartment, ...] = (
    _dept("01", "预防保健科", "诊疗科目", aliases=("预保科", "预防保健")),
    _dept("02", "全科医疗科", "诊疗科目", aliases=("全科", "全科医学科")),
    _dept("03", "内科", "诊疗科目"),
    _dept("03.01", "呼吸内科专业", "临床", "03", ("呼吸内科", "呼吸科")),
    _dept("03.02", "消化内科专业", "临床", "03", ("消化内科", "消化科")),
    _dept("03.03", "神经内科专业", "临床", "03", ("神经内科", "脑病科")),
    _dept("03.04", "心血管内科专业", "临床", "03", ("心内科", "心血管内科")),
    _dept("03.05", "血液内科专业", "临床", "03", ("血液科", "血液病科")),
    _dept("03.06", "肾病学专业", "临床", "03", ("肾内科", "肾病科")),
    _dept("03.07", "内分泌专业", "临床", "03", ("内分泌科", "代谢病科")),
    _dept("03.08", "免疫学专业", "临床", "03", ("风湿免疫科", "免疫科")),
    _dept("03.09", "变态反应专业", "临床", "03", ("过敏反应科", "变态反应科")),
    _dept("03.10", "老年病专业", "临床", "03", ("老年医学科", "老年病科")),
    _dept("04", "外科", "诊疗科目"),
    _dept("04.01", "普通外科专业", "临床", "04", ("普外科", "普通外科")),
    _dept("04.02", "神经外科专业", "临床", "04", ("神经外科", "脑外科")),
    _dept("04.03", "骨科专业", "临床", "04", ("骨科", "骨外科")),
    _dept("04.04", "泌尿外科专业", "临床", "04", ("泌尿外科",)),
    _dept("04.05", "胸外科专业", "临床", "04", ("胸外科", "胸外")),
    _dept("04.06", "心脏大血管外科专业", "临床", "04", ("心外科", "心血管外科", "心脏外科")),
    _dept("04.07", "烧伤科专业", "临床", "04", ("烧伤科",)),
    _dept("04.08", "整形外科专业", "临床", "04", ("整形外科", "整形科")),
    _dept("05", "妇产科", "诊疗科目"),
    _dept("05.01", "妇科专业", "临床", "05", ("妇科",)),
    _dept("05.02", "产科专业", "临床", "05", ("产科",)),
    _dept("05.03", "计划生育专业", "临床", "05", ("计划生育科", "计生科")),
    _dept("05.04", "优生学专业", "临床", "05", ("优生优育",)),
    _dept("05.05", "生殖健康与不孕症专业", "临床", "05", ("生殖医学科", "不孕不育科")),
    _dept("06", "妇女保健科", "诊疗科目"),
    _dept("06.01", "青春期保健专业", "保健", "06", ("青春期保健",)),
    _dept("06.02", "围产期保健专业", "保健", "06", ("围产保健",)),
    _dept("06.03", "更年期保健专业", "保健", "06", ("更年期保健",)),
    _dept("06.04", "妇女心理卫生专业", "保健", "06", ("妇女心理",)),
    _dept("06.05", "妇女营养专业", "保健", "06", ("妇女营养",)),
    _dept("07", "儿科", "诊疗科目"),
    _dept("07.01", "新生儿专业", "临床", "07", ("新生儿科",)),
    _dept("07.02", "小儿传染病专业", "临床", "07", ("小儿感染科",)),
    _dept("07.03", "小儿消化专业", "临床", "07", ("小儿消化科",)),
    _dept("07.04", "小儿呼吸专业", "临床", "07", ("小儿呼吸科",)),
    _dept("07.05", "小儿心脏病专业", "临床", "07", ("小儿心内科", "儿童心脏科")),
    _dept("07.06", "小儿肾病专业", "临床", "07", ("小儿肾内科",)),
    _dept("07.07", "小儿血液病专业", "临床", "07", ("小儿血液科",)),
    _dept("07.08", "小儿神经病学专业", "临床", "07", ("小儿神经科",)),
    _dept("07.09", "小儿内分泌专业", "临床", "07", ("小儿内分泌科",)),
    _dept("07.10", "小儿遗传病专业", "临床", "07", ("儿童遗传病科",)),
    _dept("07.11", "小儿免疫专业", "临床", "07", ("小儿免疫科",)),
    _dept("08", "小儿外科", "诊疗科目"),
    _dept("08.01", "小儿普通外科专业", "临床", "08", ("小儿普外科",)),
    _dept("08.02", "小儿骨科专业", "临床", "08", ("儿童骨科",)),
    _dept("08.03", "小儿泌尿外科专业", "临床", "08", ("小儿泌尿外科",)),
    _dept("08.04", "小儿胸心外科专业", "临床", "08", ("小儿心胸外科",)),
    _dept("08.05", "小儿神经外科专业", "临床", "08", ("小儿神经外科",)),
    _dept("09", "儿童保健科", "诊疗科目"),
    _dept("09.01", "儿童生长发育专业", "保健", "09", ("生长发育门诊",)),
    _dept("09.02", "儿童营养专业", "保健", "09", ("儿童营养",)),
    _dept("09.03", "儿童心理卫生专业", "保健", "09", ("儿童心理",)),
    _dept("09.04", "儿童五官保健专业", "保健", "09", ("儿童五官保健",)),
    _dept("09.05", "儿童康复专业", "保健", "09", ("儿童康复",)),
    _dept("10", "眼科", "诊疗科目"),
    _dept("11", "耳鼻咽喉科", "诊疗科目", aliases=("五官科", "耳鼻喉科")),
    _dept("11.01", "耳科专业", "临床", "11", ("耳科",)),
    _dept("11.02", "鼻科专业", "临床", "11", ("鼻科",)),
    _dept("11.03", "咽喉科专业", "临床", "11", ("咽喉科",)),
    _dept("12", "口腔科", "诊疗科目"),
    _dept("12.01", "牙体牙髓病专业", "临床", "12", ("牙体牙髓科",)),
    _dept("12.02", "牙周病专业", "临床", "12", ("牙周科",)),
    _dept("12.03", "口腔粘膜病专业", "临床", "12", ("口腔黏膜科",)),
    _dept("12.04", "儿童口腔专业", "临床", "12", ("儿童口腔科",)),
    _dept("12.05", "口腔颌面外科专业", "临床", "12", ("颌面外科",)),
    _dept("12.06", "口腔修复专业", "临床", "12", ("修复科",)),
    _dept("12.07", "口腔正畸专业", "临床", "12", ("正畸科",)),
    _dept("12.08", "口腔种植专业", "临床", "12", ("种植科",)),
    _dept("12.09", "口腔预防保健专业", "保健", "12", ("预防口腔科",)),
    _dept("13", "皮肤科", "诊疗科目"),
    _dept("13.01", "皮肤病专业", "临床", "13", ("皮肤病科",)),
    _dept("13.02", "性传播疾病专业", "临床", "13", ("性病科",)),
    _dept("14", "医疗美容科", "诊疗科目"),
    _dept("14.01", "美容外科专业", "临床", "14", ("美容外科",)),
    _dept("14.02", "美容牙科专业", "临床", "14", ("美容牙科",)),
    _dept("14.03", "美容皮肤科专业", "临床", "14", ("美容皮肤科",)),
    _dept("14.04", "美容中医科专业", "临床", "14", ("美容中医科",)),
    _dept("15", "精神科", "诊疗科目"),
    _dept("15.01", "精神病专业", "临床", "15", ("精神病科",)),
    _dept("15.02", "精神卫生专业", "临床", "15", ("精神卫生科",)),
    _dept("15.03", "药物依赖专业", "临床", "15", ("成瘾医学科",)),
    _dept("15.04", "精神康复专业", "临床", "15", ("精神康复科",)),
    _dept("15.05", "社区防治专业", "临床", "15", ("精神社区防治",)),
    _dept("15.06", "临床心理专业", "临床", "15", ("心理科", "临床心理科")),
    _dept("15.07", "司法精神专业", "临床", "15", ("司法精神医学科",)),
    _dept("16", "传染科", "诊疗科目", aliases=("感染性疾病科", "感染科")),
    _dept("16.01", "肠道传染病专业", "临床", "16", ("肠道门诊",)),
    _dept("16.02", "呼吸道传染病专业", "临床", "16", ("呼吸道传染病科",)),
    _dept("16.03", "肝炎专业", "临床", "16", ("肝病科",)),
    _dept("16.04", "虫媒传染病专业", "临床", "16", ("虫媒传染病科",)),
    _dept("16.05", "动物源性传染病专业", "临床", "16", ("动物源性传染病科",)),
    _dept("16.06", "蠕虫病专业", "临床", "16", ("寄生虫病科",)),
    _dept("17", "结核病科", "诊疗科目"),
    _dept("18", "地方病科", "诊疗科目"),
    _dept("19", "肿瘤科", "诊疗科目"),
    _dept("20", "急诊医学科", "诊疗科目", aliases=("急诊科",)),
    _dept("21", "康复医学科", "诊疗科目", aliases=("康复科",)),
    _dept("22", "运动医学科", "诊疗科目"),
    _dept("23", "职业病科", "诊疗科目"),
    _dept("23.01", "职业中毒专业", "临床", "23", ("职业中毒科",)),
    _dept("23.02", "尘肺专业", "临床", "23", ("尘肺科",)),
    _dept("23.03", "放射病专业", "临床", "23", ("放射病科",)),
    _dept("23.04", "物理因素损伤专业", "临床", "23", ("物理因素损伤科",)),
    _dept("23.05", "职业健康监护专业", "临床", "23", ("职业健康监护",)),
    _dept("24", "临终关怀科", "诊疗科目", aliases=("安宁疗护科",)),
    _dept("25", "特种医学科", "诊疗科目"),
    _dept("26", "麻醉科", "诊疗科目"),
    _dept("27", "疼痛科", "诊疗科目"),
    _dept("28", "重症医学科", "诊疗科目", aliases=("ICU", "重症监护室")),
    _dept("30", "医学检验科", "医技"),
    _dept("30.01", "临床体液、血液专业", "医技", "30", ("临床血液体液检验",)),
    _dept("30.02", "临床微生物学专业", "医技", "30", ("微生物检验",)),
    _dept("30.03", "临床化学检验专业", "医技", "30", ("生化检验",)),
    _dept("30.04", "临床免疫、血清学专业", "医技", "30", ("免疫检验", "血清学检验")),
    _dept("30.05", "临床细胞分子遗传学专业", "医技", "30", ("分子诊断", "遗传检验")),
    _dept("31", "病理科", "医技"),
    _dept("32", "医学影像科", "医技"),
    _dept("32.01", "X线诊断专业", "医技", "32", ("放射科X线",)),
    _dept("32.02", "CT诊断专业", "医技", "32", ("CT室",)),
    _dept("32.03", "磁共振成像诊断专业", "医技", "32", ("MRI室", "磁共振室")),
    _dept("32.04", "核医学专业", "医技", "32", ("核医学科",)),
    _dept("32.05", "超声诊断专业", "医技", "32", ("超声科", "B超室")),
    _dept("32.06", "心电诊断专业", "医技", "32", ("心电图室",)),
    _dept("32.07", "脑电及脑血流图诊断专业", "医技", "32", ("脑电图室",)),
    _dept("32.08", "神经肌肉电图专业", "医技", "32", ("肌电图室",)),
    _dept("32.09", "介入放射学专业", "医技", "32", ("介入科", "介入放射科")),
    _dept("32.10", "放射治疗专业", "医技", "32", ("放疗科",)),
    _dept("50", "中医科", "诊疗科目"),
    _dept("50.01", "中医内科专业", "临床", "50", ("中医内科",)),
    _dept("50.02", "中医外科专业", "临床", "50", ("中医外科",)),
    _dept("50.03", "中医妇产科专业", "临床", "50", ("中医妇科",)),
    _dept("50.04", "中医儿科专业", "临床", "50", ("中医儿科",)),
    _dept("50.05", "中医皮肤科专业", "临床", "50", ("中医皮肤科",)),
    _dept("50.06", "中医眼科专业", "临床", "50", ("中医眼科",)),
    _dept("50.07", "中医耳鼻咽喉科专业", "临床", "50", ("中医耳鼻喉科",)),
    _dept("50.08", "中医口腔科专业", "临床", "50", ("中医口腔科",)),
    _dept("50.09", "中医肿瘤科专业", "临床", "50", ("中医肿瘤科",)),
    _dept("50.10", "中医骨伤科专业", "临床", "50", ("骨伤科",)),
    _dept("50.11", "中医肛肠科专业", "临床", "50", ("肛肠科",)),
    _dept("50.12", "中医老年病科专业", "临床", "50", ("中医老年病科",)),
    _dept("50.13", "针灸科专业", "临床", "50", ("针灸科",)),
    _dept("50.14", "推拿科专业", "临床", "50", ("推拿科",)),
    _dept("50.15", "中医康复医学专业", "临床", "50", ("中医康复科",)),
    _dept("50.16", "中医急诊专业", "临床", "50", ("中医急诊",)),
    _dept("51", "民族医学科", "诊疗科目"),
    _dept("51.01", "维吾尔医学专业", "临床", "51", ("维医科",)),
    _dept("51.02", "藏医学专业", "临床", "51", ("藏医科",)),
    _dept("51.03", "蒙医学专业", "临床", "51", ("蒙医科",)),
    _dept("51.04", "彝医学专业", "临床", "51", ("彝医科",)),
    _dept("51.05", "傣医学专业", "临床", "51", ("傣医科",)),
    _dept("52", "中西医结合科", "诊疗科目"),
)

STANDARD_DEPARTMENT_BY_CODE = {department.code: department for department in STANDARD_DEPARTMENTS}


def _alias_text(department: StandardDepartment) -> str | None:
    return ";".join(department.aliases) if department.aliases else None


def _changed(existing: DictDepartment, department: StandardDepartment) -> bool:
    return (
        existing.dept_name != department.name
        or existing.dept_alias != _alias_text(department)
        or existing.dept_type != department.dept_type
        or existing.oid != department.code.removeprefix("NHC-")
        or existing.source_batch_id != STANDARD_DEPARTMENT_VERSION
    )


def sync_standard_departments(db: Session, operator_name: str) -> dict[str, Any]:
    codes = [department.code for department in STANDARD_DEPARTMENTS]
    existing_by_code = {
        department.dept_code: department
        for department in db.scalars(select(DictDepartment).where(DictDepartment.dept_code.in_(codes))).all()
    }
    created_count = 0
    changed_count = 0

    for department in STANDARD_DEPARTMENTS:
        existing = existing_by_code.get(department.code)
        if existing:
            if _changed(existing, department):
                changed_count += 1
            existing.dept_name = department.name
            existing.dept_alias = _alias_text(department)
            existing.dept_type = department.dept_type
            existing.oid = department.code.removeprefix("NHC-")
            existing.source_batch_id = STANDARD_DEPARTMENT_VERSION
            existing.updated_by = operator_name
        else:
            existing = DictDepartment(
                dept_code=department.code,
                dept_name=department.name,
                dept_alias=_alias_text(department),
                dept_type=department.dept_type,
                oid=department.code.removeprefix("NHC-"),
                status="ACTIVE",
                source_batch_id=STANDARD_DEPARTMENT_VERSION,
                created_by=operator_name,
                updated_by=operator_name,
            )
            db.add(existing)
            existing_by_code[department.code] = existing
            created_count += 1

    db.flush()

    for department in STANDARD_DEPARTMENTS:
        row = existing_by_code[department.code]
        row.parent_dept_id = existing_by_code[department.parent_code].dept_id if department.parent_code else None

    return {
        "batch_id": STANDARD_DEPARTMENT_VERSION,
        "source_type": "STANDARD_DEPARTMENT_LIBRARY",
        "source_system": "H-UMDG",
        "source_file_name": "built-in-standard-departments",
        "sheet_name": None,
        "source_row_count": len(STANDARD_DEPARTMENTS),
        "unique_key_count": len(STANDARD_DEPARTMENTS),
        "skipped_duplicate_count": 0,
        "success_count": len(STANDARD_DEPARTMENTS),
        "failed_count": 0,
        "duplicate_count": len(STANDARD_DEPARTMENTS) - created_count,
        "disabled_count": 0,
        "transcoded_count": 0,
        "changed_count": changed_count,
        "mapped_count": 0,
        "retained_count": created_count,
        "failures": [],
        "standard_source": STANDARD_DEPARTMENT_SOURCE,
        "standard_version": STANDARD_DEPARTMENT_VERSION,
    }


def standard_department_metadata(dept_code: str) -> dict[str, Any]:
    standard = STANDARD_DEPARTMENT_BY_CODE.get(dept_code)
    if standard is None:
        return {
            "standard_source": None,
            "standard_version": None,
            "standard_scope": None,
            "maintenance_mode": "LOCAL_IMPORTED",
        }
    return {
        "standard_source": STANDARD_DEPARTMENT_SOURCE,
        "standard_version": STANDARD_DEPARTMENT_VERSION,
        "standard_scope": standard.scope,
        "maintenance_mode": "STANDARD_LIBRARY_TOGGLE",
    }
