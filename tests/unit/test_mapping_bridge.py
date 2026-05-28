from app.services.mapping_bridge import normalize_category


def test_normalize_category_uses_api_storage_form() -> None:
    assert normalize_category("material") == "MATERIAL"
    assert normalize_category(" Department ") == "DEPARTMENT"
