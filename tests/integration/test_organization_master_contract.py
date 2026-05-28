from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app


HEADERS = {"X-API-Key": "change-me", "X-Operator-Name": "pytest", "X-Operator-Role": "data_steward"}
EXTERNAL_HEADERS = {"X-API-Key": "hudmp-equipment-os-dev-20260525"}


def test_hmdm_campus_department_person_discipline_mapping_contract() -> None:
    client = TestClient(app)
    suffix = uuid.uuid4().hex[:8]

    campus = client.post(
        "/api/v1/campuses",
        headers=HEADERS,
        json={
            "campus_code": f"PY-CAMPUS-{suffix}",
            "campus_name": f"pytest 院区 {suffix}",
            "campus_short_name": "pytest院区",
            "organization_id": "ORG-PYTEST",
            "status": "ACTIVE",
        },
    )
    assert campus.status_code == 200, campus.text
    campus_data = campus.json()["data"]
    assert campus_data["status"] == "ACTIVE"

    disabled = client.patch(
        f"/api/v1/campuses/PY-CAMPUS-{suffix}/status",
        headers=HEADERS,
        json={"status": "INACTIVE"},
    )
    assert disabled.status_code == 200, disabled.text
    enabled = client.patch(
        f"/api/v1/campuses/PY-CAMPUS-{suffix}/status",
        headers=HEADERS,
        json={"status": "ACTIVE"},
    )
    assert enabled.status_code == 200, enabled.text

    department = client.post(
        "/api/v1/departments",
        headers=HEADERS,
        json={
            "dept_code": f"PY-DEPT-{suffix}",
            "dept_name": f"pytest 科室 {suffix}",
            "campus_id": campus_data["id"],
            "dept_type": "临床科室",
            "is_clinical": True,
            "status": "ACTIVE",
        },
    )
    assert department.status_code == 200, department.text
    dept_data = department.json()["data"]
    assert dept_data["campusId"] == campus_data["id"]

    person = client.post(
        "/api/v1/persons",
        headers=HEADERS,
        json={
            "person_code": f"PY-PERSON-{suffix}",
            "employee_no": f"E-{suffix}",
            "person_name": f"pytest 人员 {suffix}",
            "department_id": dept_data["id"],
            "campus_id": campus_data["id"],
            "person_type": "设备工程师",
            "status": "ACTIVE",
        },
    )
    assert person.status_code == 200, person.text
    person_data = person.json()["data"]
    assert person_data["departmentName"] == dept_data["name"]

    discipline = client.post(
        "/api/v1/disciplines",
        headers=HEADERS,
        json={
            "discipline_code": f"PY-DISC-{suffix}",
            "discipline_name": f"pytest 学科 {suffix}",
            "discipline_type": "二级学科",
            "level": 2,
            "is_key_discipline": True,
            "status": "ACTIVE",
        },
    )
    assert discipline.status_code == 200, discipline.text
    discipline_data = discipline.json()["data"]
    assert discipline_data["isKeyDiscipline"] is True

    mapping = client.post(
        "/api/v1/department-discipline-mappings",
        headers=HEADERS,
        json={
            "department_id": dept_data["id"],
            "discipline_id": discipline_data["id"],
            "relation_type": "主责学科",
            "is_primary": True,
            "weight": 100,
            "status": "ACTIVE",
        },
    )
    assert mapping.status_code == 200, mapping.text
    mapping_data = mapping.json()["data"]
    assert mapping_data["departmentName"] == dept_data["name"]
    assert mapping_data["disciplineName"] == discipline_data["name"]

    external_departments = client.get(
        "/api/v1/master-data/departments",
        headers=EXTERNAL_HEADERS,
        params={"keyword": f"PY-DEPT-{suffix}"},
    )
    assert external_departments.status_code == 200, external_departments.text
    records = external_departments.json()["data"]["records"]
    assert records[0]["source"] == "h-mdm"
    assert records[0]["campusName"] == campus_data["name"]

    external_persons = client.get(
        "/api/v1/master-data/persons",
        headers=EXTERNAL_HEADERS,
        params={"keyword": f"E-{suffix}"},
    )
    assert external_persons.status_code == 200, external_persons.text
    assert external_persons.json()["data"]["records"][0]["departmentName"] == dept_data["name"]

    external_mappings = client.get(
        "/api/v1/master-data/department-discipline-mappings",
        headers=EXTERNAL_HEADERS,
        params={"departmentId": dept_data["id"]},
    )
    assert external_mappings.status_code == 200, external_mappings.text
    assert external_mappings.json()["data"]["records"][0]["disciplineName"] == discipline_data["name"]
