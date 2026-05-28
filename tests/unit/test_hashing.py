from app.services.hashing import file_sha256, payload_hash


def test_payload_hash_is_order_insensitive() -> None:
    assert payload_hash({"b": 2, "a": 1}) == payload_hash({"a": 1, "b": 2})


def test_file_hash_is_stable() -> None:
    assert file_sha256(b"hudmp") == file_sha256(b"hudmp")
