from datetime import datetime
import re


DATE_FORMATS = (
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%d-%m-%y",
    "%d/%m/%y",
    "%d-%b-%y",
    "%d-%b-%Y",
    "%d-%B-%y",
    "%d-%B-%Y",
)


def parse_invoice_date(value):
    text = str(value or "")
    candidates = re.findall(
        r"\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b\d{1,2}[-/][A-Za-z]{3,9}[-/]\d{2,4}\b",
        text,
    )

    for candidate in candidates:
        normalized = candidate.replace("/", "-")
        for date_format in DATE_FORMATS:
            try:
                return datetime.strptime(normalized, date_format).date().isoformat()
            except ValueError:
                continue

    return None
