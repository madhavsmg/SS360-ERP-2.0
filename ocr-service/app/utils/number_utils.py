import re


def parse_indian_number(value):
    if value is None:
        return None

    text = str(value).strip()
    is_negative = bool(re.search(r"\(-\)|^\s*-|Less\s*:|Less", text, re.I))
    text = text.replace("\u20b9", "")
    text = re.sub(r"[^0-9.]", "", text)

    if not text:
        return None

    try:
        parsed = float(text)
    except ValueError:
        return None

    return -parsed if is_negative else parsed
