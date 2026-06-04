from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SRC = ROOT / "src" / "frontend" / "src"
BACKEND_SRC = ROOT / "src" / "backend" / "app"


def read_frontend(path: str) -> str:
    return (FRONTEND_SRC / path).read_text(encoding="utf-8")


def read_backend(path: str) -> str:
    return (BACKEND_SRC / path).read_text(encoding="utf-8")


def test_space_location_master_menu_is_explicit_and_versioned() -> None:
    main = read_frontend("main.tsx")
    app_meta = read_frontend("config/appMeta.ts")

    assert 'VERSION_CORE = "0.8.5"' in app_meta
    assert 'VERSION_BUILD = "20260601.013"' in app_meta
    assert "空间位置主数据" in main

    navigation_section = main.split('key: "space"', 1)[1].split("},", 1)[0]
    for label in ["空间位置管理", "科室空间映射", "主数据使用管理"]:
        assert label in main
    for forbidden in ["院区主数据", "楼宇主数据", "楼层主数据", "房间主数据"]:
        assert forbidden not in navigation_section

    assert 'itemIds: ["space-location-management", "department-space-mapping", "space-master-usage"]' in main
    assert "组织与人员主数据" in main
    assert '"organization-master", "staff-master", "staff-roles", "person-employment", "staff-licenses", "org-people-master-usage"' in main


def test_space_location_pages_explain_hierarchy_and_hmelc_boundary() -> None:
    component = read_frontend("components/SpaceLocationMasterWorkbench.tsx")

    for text in [
        "院区是医院空间资源的顶层主数据",
        "楼宇作为院区下级主数据独立管理，不直接塞进院区表",
        "科室是组织单元，院区、楼宇、楼层、房间是空间单元",
        "H-MELC 医学装备平台只消费标准空间主数据",
        "空间树",
        "树视图",
        "院区视图",
        "楼宇视图",
        "楼层视图",
        "房间视图",
        "WL-C01-B03-F02-R0215",
        "主院区 → 医技楼 → 1层 → 放射科DR室 → 某台DR设备",
    ]:
        assert text in component

    assert "设备档案" not in component


def test_dictionary_catalog_defines_space_master_blueprints() -> None:
    catalog = read_backend("services/dictionary_catalog.py")

    for key in ["CAMPUS", "BUILDING", "FLOOR", "ROOM_AREA", "DEPARTMENT_SPACE_MAPPING", "SPACE_CODE_RULE"]:
        assert f'"dictionary_key": "{key}"' in catalog

    assert "院区是医院空间资源的顶层主数据，不只是院区名称表" in catalog
    assert "楼宇通过空间位置统一接口维护，必须挂在院区下" in catalog
    assert "通过映射关系连接组织单元和空间单元" in catalog


def test_space_hierarchy_catalog_points_to_real_crud_interfaces() -> None:
    catalog = read_backend("services/dictionary_catalog.py")

    for key in ["CAMPUS", "BUILDING", "FLOOR", "ROOM_AREA"]:
        section = catalog.split(f'"dictionary_key": "{key}"', 1)[1].split('"dictionary_key":', 1)[0]
        assert '"status": "AVAILABLE"' in section
        assert "GET /api/v1/space-locations?type=" in section
        assert "POST /api/v1/space-locations" in section
        assert "PATCH /api/v1/space-locations/{location_id}" in section
        assert "PATCH /api/v1/space-locations/{location_id}/status" in section
        assert "DELETE /api/v1/space-locations/{location_id}" in section
        assert "GET /api/v1/master-data/locations?type=" in section
        assert "PLANNED /api/v1/space/" not in section


def test_space_location_backend_exposes_crud_and_external_contract() -> None:
    router = read_backend("api/router.py")
    route = read_backend("api/routes/space_locations.py")

    assert "space_locations.router" in router
    assert "space_locations.registration_certificates_router" in router
    assert "space_locations.udis_router" in router
    assert "space_locations.master_data_router" in router
    for path in [
        '@router.get("",',
        '@router.get("/tree"',
        '@router.post("",',
        '@router.patch("/{location_id}"',
        '@router.delete("/{location_id}"',
        '@master_data_router.get("/locations")',
        '@master_data_router.get("/locations/tree")',
        '@master_data_router.get("/registration-certificates")',
        '@master_data_router.get("/udis")',
    ]:
        assert path in route
    assert "MdmSpaceLocation" in route


def test_registration_certificate_and_udi_backend_use_governed_runtime_data() -> None:
    route = read_backend("api/routes/space_locations.py")

    for path in [
        '@registration_certificates_router.get("",',
        '@registration_certificates_router.post("",',
        '@registration_certificates_router.patch("/{certificate_id}"',
        '@registration_certificates_router.patch("/{certificate_id}/status"',
        '@registration_certificates_router.delete("/{certificate_id}"',
        '@udis_router.get("",',
        '@udis_router.post("",',
        '@udis_router.patch("/{udi_id}"',
        '@udis_router.patch("/{udi_id}/status"',
        '@udis_router.delete("/{udi_id}"',
    ]:
        assert path in route

    assert "MdmRegistrationCertificate" in route
    assert "MdmUdi" in route
    assert "MdmRegistrationCertificate" in route
    assert "MdmUdi" in route
    assert "OrganizationManageAuth" in route


def test_space_location_frontend_defaults_tree_create_to_campus() -> None:
    component = read_frontend("components/SpaceLocationMasterWorkbench.tsx")

    assert "emptyRemoteSpaceData" in component
    assert "client ? emptyRemoteSpaceData : initialSpaceData" in component
    assert "空间位置接口不可用，未加载后端空间主数据" in component
    assert "使用本地示例数据" not in component
    assert 'message.success("空间主数据刷新完成")' in component
    assert 'loadRemote().then((ok)' in component
    assert 'effectiveView === "space-location-management" ? "campus-master" : effectiveView' in component
    assert 'const normalizedView = view === "space-location-management" ? "campus-master" : view;' in component
    assert "parent_id: floor?.key," in component
    assert "parent_id: floor?.key || building?.key" not in component
    assert "client.saveSpaceLocation" in component
    assert "client.updateSpaceLocationStatus" in component
    assert "client.deleteSpaceLocation" in component
    assert "已作为空间位置主数据页面动作触发" not in component
    assert "已进入维护草稿" not in component


def test_generic_master_pages_do_not_show_action_trigger_placeholders() -> None:
    main = read_frontend("main.tsx")

    assert "已作为当前主数据对象页面动作触发" not in main
    assert "已作为主数据使用管理页面动作触发" not in main


def test_equipment_registration_and_udi_frontend_are_real_governance_pages() -> None:
    main = read_frontend("main.tsx")
    api = read_frontend("lib/api.ts")
    component = read_frontend("components/EquipmentRegistrationUdiWorkbench.tsx")

    assert 'import { EquipmentRegistrationUdiWorkbench }' in main
    assert 'const showEquipmentRegistrationUdi = ["equipment-registration", "equipment-udi-reserved"].includes(activeId);' in main
    assert 'activeView={activeId === "equipment-udi-reserved" ? "udi" : "registration"}' in main
    assert 'label: "UDI数据库"' in main
    assert "UDI数据库（预留）" not in main
    assert '"equipment-registration",\n  "equipment-manufacturer-link"' not in main
    assert 'const templateMasterDataPageIds = new Set([\n  "snomed-ct-reserved"' in main
    assert 'const reservedMasterDataIds = new Set([\n  "snomed-ct-reserved"' in main

    for method in [
        "listRegistrationCertificates",
        "saveRegistrationCertificate",
        "updateRegistrationCertificateStatus",
        "deleteRegistrationCertificate",
        "listUdis",
        "saveUdi",
        "updateUdiStatus",
        "deleteUdi",
    ]:
        assert method in api
        assert method in component

    for label in ["新增注册证", "新增 UDI", "医疗器械注册证库", "UDI 数据库", "删除后 H-MELC 将无法再选择该主数据"]:
        assert label in component


def test_equipment_standard_name_frontend_has_real_crud_controls() -> None:
    api = read_frontend("lib/api.ts")
    component = read_frontend("components/EquipmentDictionaryWorkbench.tsx")
    types = read_frontend("types.ts")

    assert "EquipmentStandardNameInput" in types
    for method in [
        "saveEquipmentStandardName",
        "updateEquipmentStandardNameStatus",
        "deleteEquipmentStandardName",
    ]:
        assert method in api
        assert method in component

    for label in ["新增标准名称", "编辑设备标准名称", "设备标准名称治理", "治理操作"]:
        assert label in component


def test_equipment_brand_model_and_standard_library_are_real_governance_pages() -> None:
    main = read_frontend("main.tsx")
    api = read_frontend("lib/api.ts")
    component = read_frontend("components/EquipmentBrandModelWorkbench.tsx")
    router = read_backend("api/router.py")
    route = read_backend("api/routes/equipment_masters.py")
    master_data = read_backend("api/routes/master_data.py")

    assert 'import { EquipmentBrandModelWorkbench }' in main
    assert 'const showEquipmentBrandModel = ["equipment-brand-model", "standard-equipment-library"].includes(activeId);' in main
    assert 'const showEquipmentDictionary = ["equipment-category", "equipment-standard-name", "device-classification"].includes(activeId);' in main
    assert 'activeView={activeId === "standard-equipment-library" ? "standard-equipment" : "brand-model"}' in main
    governance_section = main.split("const masterDataGovernanceIds = new Set([", 1)[1].split("]);", 1)[0]
    assert '"equipment-brand-model"' not in governance_section
    assert '"standard-equipment-library"' not in governance_section

    for method in [
        "listEquipmentBrandModels",
        "saveEquipmentBrandModel",
        "updateEquipmentBrandModelStatus",
        "deleteEquipmentBrandModel",
        "listStandardEquipment",
        "saveStandardEquipment",
        "updateStandardEquipmentStatus",
        "deleteStandardEquipment",
    ]:
        assert method in api
        assert method in component

    for label in ["新增品牌型号", "新增标准设备", "品牌型号库", "标准设备库", "删除后 H-MELC 将无法再选择该主数据"]:
        assert label in component

    for path in [
        "equipment_masters.brand_models_router",
        "equipment_masters.standard_equipment_router",
        "equipment_masters.master_data_router",
    ]:
        assert path in router

    for path in [
        '@brand_models_router.get("",',
        '@brand_models_router.post("",',
        '@brand_models_router.patch("/{record_id}"',
        '@brand_models_router.patch("/{record_id}/status"',
        '@brand_models_router.delete("/{record_id}"',
        '@standard_equipment_router.get("",',
        '@standard_equipment_router.post("",',
        '@standard_equipment_router.patch("/{record_id}"',
        '@standard_equipment_router.patch("/{record_id}/status"',
        '@standard_equipment_router.delete("/{record_id}"',
        '@master_data_router.get("/equipment-brand-models")',
        '@master_data_router.get("/standard-equipment-library")',
    ]:
        assert path in route

    assert "MdmEquipmentBrandModel" in route
    assert "MdmStandardEquipment" in route
    assert '"md:equipment-brand-model:read"' in master_data
    assert '"md:standard-equipment:read"' in master_data


def test_hmelc_required_external_master_data_api_surface_is_complete() -> None:
    master_data = read_backend("api/routes/master_data.py")
    space_locations = read_backend("api/routes/space_locations.py")
    equipment_masters = read_backend("api/routes/equipment_masters.py")

    for path in [
        '@router.get("/health")',
        '@router.get("/campuses")',
        '@router.get("/departments")',
        '@router.get("/departments/tree")',
        '@router.get("/persons")',
        '@router.get("/device-classification/catalog")',
        '@router.get("/device-classification/tree")',
        '@router.get("/business-partners")',
        '@router.post("/business-partners/match")',
        '@router.get("/equipment/standard-names")',
        '@router.get("/equipment/standard-names/{id}")',
    ]:
        assert path in master_data

    for path in [
        '@master_data_router.get("/locations")',
        '@master_data_router.get("/locations/{location_id}")',
        '@master_data_router.get("/locations/tree")',
        '@master_data_router.get("/registration-certificates")',
        '@master_data_router.get("/registration-certificates/{certificate_id}")',
        '@master_data_router.get("/udis")',
        '@master_data_router.get("/udis/{udi_id}")',
    ]:
        assert path in space_locations

    for path in [
        '@master_data_router.get("/equipment-brand-models")',
        '@master_data_router.get("/equipment-brand-models/{record_id}")',
        '@master_data_router.get("/standard-equipment-library")',
        '@master_data_router.get("/standard-equipment-library/{record_id}")',
    ]:
        assert path in equipment_masters

    for scope in [
        "md:organization:read",
        "md:organization:tree",
        "md:person:read",
        "md:location:read",
        "md:location:tree",
        "md:device-classification:read",
        "md:device-classification:tree",
        "md:business-partner:read",
        "md:business-partner:match",
        "md:equipment-standard-name:read",
        "md:equipment-brand-model:read",
        "md:standard-equipment:read",
        "md:registration-certificate:read",
        "md:udi:read",
    ]:
        assert scope in f"{master_data}\n{space_locations}\n{equipment_masters}"


def test_external_master_data_payload_normalizes_items_page_total_contract() -> None:
    master_data = read_backend("api/routes/master_data.py")

    assert "def _normalize_external_payload" in master_data
    assert 'payload["items"] = records' in master_data
    assert 'payload["records"] = items' in master_data
    assert 'page_meta["page_size"] = page_size' in master_data
    assert 'page_meta["total"] = total' in master_data
    assert "data = _normalize_external_payload(data)" in master_data


