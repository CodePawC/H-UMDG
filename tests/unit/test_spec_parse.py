from app.services.spec_parse import split_spec


def test_split_spec_with_numeric_unit() -> None:
    assert split_spec("10mm") == ("10", "mm", None)


def test_split_spec_keeps_unparsed_raw_text() -> None:
    assert split_spec("custom size") == (None, None, "custom size")


def test_split_spec_complex_real_spec_keeps_raw() -> None:
    raw = "杆直径：φ3mm、φ5mm、φ8mm； 杆长度L：20-150mm、50-300mm、150-400mm"
    assert split_spec(raw) == (None, None, raw)
