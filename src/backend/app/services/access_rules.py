"""访问规则引擎——从人员属性推导系统权限。

核心理念：系统权限不是"分配"给人的，而是人的岗位属性天生携带的。
一个人员记录 + 一组匹配规则 = 自动推导出可访问的系统列表和角色。

规则配置：
  每个 rule 包含 match 条件和 roles 结果。
  match 条件支持按 position、department_name、person_type 等字段匹配。
  所有匹配的规则取并集。

规则存储：
  当前为代码级配置（Python dict），后续可迁移到数据库表 + 管理界面。
"""

from __future__ import annotations

from typing import Any

# ── 规则定义 ──────────────────────────────────────────────────────
# match 中的字段均为可选，缺失的字段不参与匹配。
# 多个字段之间为 AND 关系；同一字段的多个值为 OR 关系（列表）。
# 空 match 表示匹配所有人。

ACCESS_RULES: list[dict[str, Any]] = [
    # 系统管理员 — 全系统访问
    {
        "rule_id": "umdg-sysadmin",
        "description": "系统管理员 → 所有系统",
        "system_code": "H-UMDG",
        "match": {"position": ["系统管理员", "信息科主任"]},
        "roles": ["SYS_ADMIN"],
    },
    {
        "rule_id": "melc-sysadmin",
        "description": "系统管理员 → H-MELC 全功能",
        "system_code": "H-MELC",
        "match": {"position": ["系统管理员", "信息科主任"]},
        "roles": ["SYS_ADMIN", "DEVICE_ADMIN", "AUDIT_ADMIN"],
    },
    # 设备科
    {
        "rule_id": "melc-engineer",
        "description": "设备科工程师 → H-MELC 工程师",
        "system_code": "H-MELC",
        "match": {"department_name": "设备科", "position": "工程师"},
        "roles": ["ENGINEER", "DEPT_USER"],
    },
    {
        "rule_id": "melc-device-admin",
        "description": "设备科科长 → H-MELC 设备管理员",
        "system_code": "H-MELC",
        "match": {"department_name": "设备科", "position": "科长"},
        "roles": ["DEVICE_ADMIN", "AUDIT_ADMIN"],
    },
    # 临床科室
    {
        "rule_id": "melc-dept-user",
        "description": "临床科室用户 → H-MELC 本科室操作",
        "system_code": "H-MELC",
        "match": {"person_type": "本院职工", "department_type": "clinical"},
        "roles": ["DEPT_USER"],
    },
    {
        "rule_id": "melc-nurse",
        "description": "护士 → H-MELC 扫码报修",
        "system_code": "H-MELC",
        "match": {"position": "护士"},
        "roles": ["DEPT_USER"],
    },
    # 财务
    {
        "rule_id": "melc-finance",
        "description": "财务人员 → H-MELC 财务模块",
        "system_code": "H-MELC",
        "match": {"department_name": "财务科"},
        "roles": ["FINANCE_READ"],
    },
    # 供应商
    {
        "rule_id": "melc-supplier",
        "description": "供应商人员 → H-MELC 供应商门户",
        "system_code": "H-MELC",
        "match": {"person_type": "供应商人员"},
        "roles": ["SUPPLIER"],
    },
    # H-UMDG 主数据治理
    {
        "rule_id": "umdg-data-steward",
        "description": "数据治理相关人员 → H-UMDG 治理权限",
        "system_code": "H-UMDG",
        "match": {"position": ["数据治理员", "工程师", "设备科主任"]},
        "roles": ["DATA_STEWARD"],
    },
    {
        "rule_id": "umdg-auditor",
        "description": "审计人员 → H-UMDG 审计",
        "system_code": "H-UMDG",
        "match": {"position": ["审计员", "审计科长"]},
        "roles": ["AUDITOR"],
    },
]


# ── 规则引擎 ──────────────────────────────────────────────────────


def match_person_against_rule(person: dict[str, Any], rule_match: dict[str, Any]) -> bool:
    """判断一个人是否匹配某条规则。

    person: DictPerson 的 dict 化数据（含 department_name 等推导字段）。
    rule_match: 规则中的 match 条件，如 {"department_name": "设备科", "position": "工程师"}。
    """
    for field, expected in rule_match.items():
        actual = person.get(field)
        if actual is None:
            return False
        # 同一字段的多个值（OR 关系）
        expected_values = expected if isinstance(expected, list) else [expected]
        if str(actual).strip() not in {str(v).strip() for v in expected_values}:
            return False
    return True


def derive_person_systems(person: dict[str, Any]) -> dict[str, dict[str, list[str]]]:
    """根据人员属性匹配规则，导出 {system_code: {roles: [...]}}。

    参数：
        person: 包含 DictPerson 字段的 dict，至少应有：
            person_id, person_name, position, department_name,
            person_type, employment_status

    返回：
        {"H-MELC": {"roles": ["ENGINEER"]}, "H-UMDG": {"roles": ["DATA_STEWARD"]}}
    """
    # 非在职人员无权限
    if person.get("employment_status", "ACTIVE") not in ("ACTIVE",):
        return {}

    systems: dict[str, dict[str, list[str]]] = {}
    for rule in ACCESS_RULES:
        if not match_person_against_rule(person, rule["match"]):
            continue
        sys_code = rule["system_code"]
        if sys_code not in systems:
            systems[sys_code] = {"roles": []}
        for role in rule["roles"]:
            if role not in systems[sys_code]["roles"]:
                systems[sys_code]["roles"].append(role)

    return systems
