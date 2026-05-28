from app.services.exchange import build_file_payload_hash


def test_file_payload_hash_ignores_metadata_order() -> None:
    content = b"dept_code,dept_name\nD001,Test\n"
    left = build_file_payload_hash(content, {"source_system": "SPD", "sheet_name": None})
    right = build_file_payload_hash(content, {"sheet_name": None, "source_system": "SPD"})
    assert left == right


def test_file_payload_hash_changes_when_file_changes() -> None:
    meta = {"source_system": "SPD", "sheet_name": None}
    assert build_file_payload_hash(b"a", meta) != build_file_payload_hash(b"b", meta)
