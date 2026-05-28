import re

UNIT_SUFFIXES = (
    "mm",
    "cm",
    "m",
    "ml",
    "l",
    "μl",
    "μL",
    "UL",
    "%",
    "支",
    "个",
    "套",
    "枚",
    "根",
    "片",
    "瓶",
    "袋",
    "盒",
    "包",
)


def split_spec(raw: str | None) -> tuple[str | None, str | None, str | None]:
    """Return (spec_value, spec_unit, raw_spec_if_unparsed)."""
    if raw is None:
        return None, None, None
    s = raw.strip()
    if not s:
        return None, None, None

    for u in sorted(UNIT_SUFFIXES, key=len, reverse=True):
        if s.lower().endswith(u.lower()):
            val = s[: -len(u)].strip()
            if val and re.match(r"^[\d.]+$", val):
                return val, u, None
            break

    m = re.match(r"^([\d.]+)\s*([a-zA-Zμµ%]+)$", s)
    if m:
        return m.group(1), m.group(2), None

    return None, None, s
