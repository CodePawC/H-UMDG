from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app


HEADERS = {"X-API-Key": "change-me", "X-Operator-Name": "pytest", "X-Operator-Role": "data_steward"}
EXTERNAL_HEADERS = {"X-API-Key": "hudmp-equipment-os-dev-20260525"}


def test_hmdm_business_partner_multi_role_contract() -> None:
    client = TestClient(app)
    suffix = uuid.uuid4().hex[:8].upper()
    name = f"深圳迈瑞生物医疗电子股份有限公司{suffix}"

    created = client.post(
        "/api/v1/business-partners",
        headers=HEADERS,
        json={
            "organization_code": f"BP-{suffix}",
            "standard_name": name,
            "short_name": f"迈瑞{suffix}",
            "former_name": f"深圳迈瑞医疗{suffix}",
            "english_name": "Mindray Bio-Medical Electronics Co., Ltd.",
            "alias_names": ["迈瑞", "深圳迈瑞", "Mindray"],
            "unified_social_credit_code": f"91440300{suffix[:10]}".ljust(18, "0"),
            "organization_type": "企业",
            "registered_address": "深圳市南山区",
            "office_address": "深圳市光明区",
            "contact_phone": "400-700-5652",
            "website": "https://www.mindray.com",
            "source_system": "H-MDM",
            "remark": "pytest-business-partner",
        },
    )
    assert created.status_code == 200, created.text
    partner = created.json()["data"]
    org_id = partner["org_id"]
    assert partner["org_name"] == name

    for role_type in ["生产厂家", "供应商", "维保商", "注册证持有人"]:
        role = client.post(
            f"/api/v1/business-partners/{org_id}/roles",
            headers=HEADERS,
            json={
                "role_type": role_type,
                "business_domain": "equipment",
                "qualification_required": role_type in {"生产厂家", "维保商"},
                "status": "enabled",
            },
        )
        assert role.status_code == 200, role.text

    qualification = client.post(
        f"/api/v1/business-partners/{org_id}/qualifications",
        headers=HEADERS,
        json={
            "qualification_type": "医疗器械生产许可证",
            "certificate_no": f"粤食药监械生产许{suffix}",
            "certificate_name": "医疗器械生产许可证",
            "issuing_authority": "广东省药品监督管理局",
            "valid_from": "2026-01-01",
            "valid_to": "2030-12-31",
            "status": "enabled",
        },
    )
    assert qualification.status_code == 200, qualification.text

    contact = client.post(
        f"/api/v1/business-partners/{org_id}/contacts",
        headers=HEADERS,
        json={
            "contact_name": "王售后",
            "department": "售后服务部",
            "position": "服务经理",
            "mobile": "13800000000",
            "contact_type": "售后联系人",
            "is_primary": True,
        },
    )
    assert contact.status_code == 200, contact.text

    mapping = client.post(
        f"/api/v1/business-partners/{org_id}/external-mappings",
        headers=HEADERS,
        json={
            "source_system": "HRP",
            "external_code": f"HRP-{suffix}",
            "external_name": f"深圳迈瑞{suffix}",
            "mapping_confidence": 1,
        },
    )
    assert mapping.status_code == 200, mapping.text

    supplier_list = client.get(
        "/api/v1/business-partners",
        headers=HEADERS,
        params={"keyword": "迈瑞", "role_type": "供应商"},
    )
    assert supplier_list.status_code == 200, supplier_list.text
    assert any(item["org_id"] == org_id for item in supplier_list.json()["data"]["items"])

    external_list = client.get(
        "/api/v1/master-data/business-partners",
        headers=EXTERNAL_HEADERS,
        params={"keyword": "Mindray", "roleType": "生产厂家"},
    )
    assert external_list.status_code == 200, external_list.text
    records = external_list.json()["data"]["records"]
    assert any(record["org_id"] == org_id for record in records)
    target = next(record for record in records if record["org_id"] == org_id)
    assert target["source"] == "h-mdm"
    assert any(role["role_type"] == "manufacturer" for role in target["roles"])
    assert target["qualifications"][0]["qualification_type"] == "医疗器械生产许可证"

    matched = client.post(
        "/api/v1/master-data/business-partners/match",
        headers=EXTERNAL_HEADERS,
        json={"keyword": "深圳迈瑞", "roleType": "生产厂家", "pageSize": 5},
    )
    assert matched.status_code == 200, matched.text
    data = matched.json()["data"]
    assert data["connected"] is True
    assert data["source"] == "h-mdm"
    assert data["degraded"] is False
    assert data["recommendation"]["org_id"] == org_id
    assert data["recommendation"]["hasRequiredRole"] is True
