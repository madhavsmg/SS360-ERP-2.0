import re

from app.utils.date_utils import parse_invoice_date
from app.utils.number_utils import parse_indian_number


GSTIN_REGEX = re.compile(r"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b")
PHONE_REGEX = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}")
EMAIL_REGEX = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
HSN_REGEX = re.compile(r"\b0902\d{2,4}\b")
GRADE_REGEX = re.compile(r"\b(BOPL|BOPF|BOP|BPS|BP|PF1|PF|PD1|PD|OF|DUST|CTC)\b", re.I)
STOP_ITEM_REGEX = re.compile(
    r"\b(IGST|OUTPUT IGST|CGST|SGST|Round Off|Rounded Off|Less|Total|Amount Chargeable|HSN/SAC|Tax Amount|Bank Details|Declaration)\b",
    re.I,
)

LAYOUT_KEYWORDS = (
    "SHARON TEA AGENCY",
    "SANJAY TEA EMPORIUM",
    "SURYA TEA COMPANY",
    "TEA TRIANGLE",
    "TEA TRIANGLE PVT LTD",
    "VAISHALI TEA CO",
    "TAX INVOICE",
    "PROFORMA INVOICE",
    "GSTIN/UIN",
    "HSN/SAC",
    "OUTPUT IGST",
    "CART & COOLIE CHARGES",
)


def parse_invoice_text(raw_text, lines=None, document_type=None):
    text_lines = _clean_lines(raw_text)
    layout = _detect_layout(raw_text)

    if layout == "sharon":
        invoice = parse_sharon_tea_layout(raw_text, lines or [])
    elif layout == "tea_triangle":
        invoice = parse_tea_triangle_layout(raw_text, lines or [])
    elif layout == "tally":
        invoice = parse_tally_tax_invoice_layout(raw_text, lines or [])
    else:
        invoice = parse_generic_invoice_layout(raw_text, lines or [])

    if document_type:
        invoice["documentType"] = _normalize_document_type(document_type)
    elif "PROFORMA INVOICE" in raw_text.upper():
        invoice["documentType"] = "proforma_invoice"
    elif "TAX INVOICE" in raw_text.upper():
        invoice["documentType"] = "tax_invoice"

    return invoice


def parse_sharon_tea_layout(raw_text, lines):
    invoice = _base_invoice()
    text_lines = _clean_lines(raw_text)
    _fill_header(invoice, text_lines, raw_text)
    invoice["items"] = _parse_sharon_items(text_lines)
    _fill_totals(invoice, text_lines)
    _fill_charges_taxes_bank_transport(invoice, text_lines)
    return invoice


def parse_tally_tax_invoice_layout(raw_text, lines):
    invoice = _base_invoice()
    text_lines = _clean_lines(raw_text)
    _fill_header(invoice, text_lines, raw_text)
    invoice["items"] = _parse_tally_items(text_lines)
    _fill_totals(invoice, text_lines)
    _fill_charges_taxes_bank_transport(invoice, text_lines)
    return invoice


def parse_tea_triangle_layout(raw_text, lines):
    invoice = _base_invoice()
    text_lines = _clean_lines(raw_text)
    _fill_header(invoice, text_lines, raw_text)
    invoice["items"] = _parse_tea_triangle_items(text_lines)
    _fill_totals(invoice, text_lines)
    _fill_charges_taxes_bank_transport(invoice, text_lines)
    return invoice


def parse_generic_invoice_layout(raw_text, lines):
    invoice = _base_invoice()
    text_lines = _clean_lines(raw_text)
    _fill_header(invoice, text_lines, raw_text)
    invoice["items"] = _parse_tally_items(text_lines) or _parse_sharon_items(text_lines)
    _fill_totals(invoice, text_lines)
    _fill_charges_taxes_bank_transport(invoice, text_lines)
    return invoice


def _base_invoice():
    return {
        "documentType": "unknown",
        "supplier": {"name": "", "gstin": "", "address": "", "state": "", "email": "", "phone": ""},
        "buyer": {"name": "", "gstin": "", "address": "", "state": "", "phone": ""},
        "shipTo": {"name": "", "gstin": "", "address": "", "state": "", "phone": ""},
        "invoice": {
            "invoiceNo": "",
            "invoiceDate": "",
            "ackNo": "",
            "ackDate": "",
            "irn": "",
            "referenceNo": "",
            "placeOfSupply": "",
            "destination": "",
            "dispatchedThrough": "",
        },
        "items": [],
        "charges": [],
        "taxes": [],
        "totals": {
            "subTotal": None,
            "taxableValue": None,
            "totalQuantity": None,
            "totalBags": None,
            "totalNett": None,
            "igstAmount": None,
            "roundOff": None,
            "grandTotal": None,
            "amountInWords": "",
        },
        "bankDetails": {"accountHolder": "", "bankName": "", "accountNo": "", "ifsc": "", "branch": ""},
        "transport": {"from": "", "to": "", "name": ""},
        "confidence": {"overall": 0, "header": 0, "items": 0, "totals": 0, "warnings": []},
    }


def _detect_layout(raw_text):
    upper_text = raw_text.upper()
    if "SHARON TEA AGENCY" in upper_text:
        return "sharon"
    if "TEA TRIANGLE" in upper_text:
        return "tea_triangle"
    if any(name in upper_text for name in ("SANJAY TEA", "SURYA TEA", "VAISHALI TEA")):
        return "tally"
    if "DESCRIPTION OF GOODS" in upper_text and "HSN/SAC" in upper_text:
        return "tally"
    return "generic"


def _normalize_document_type(document_type):
    value = str(document_type or "").strip().lower().replace(" ", "_")
    if value in {"tax_invoice", "proforma_invoice", "unknown"}:
        return value
    return "unknown"


def _fill_header(invoice, lines, raw_text):
    gstins = list(dict.fromkeys(match.group(0).upper() for match in GSTIN_REGEX.finditer(raw_text.upper())))
    supplier_gstin = gstins[0] if gstins else ""
    buyer_gstin = gstins[1] if len(gstins) > 1 else ""

    supplier_name = _find_supplier_name(lines)
    buyer_name = _find_party_name(lines, ("buyer", "bill to", "consignee"))
    ship_name = _find_party_name(lines, ("ship to", "dispatch to"))

    invoice["supplier"].update(
        {
            "name": supplier_name,
            "gstin": supplier_gstin,
            "address": _collect_address(lines, supplier_name),
            "state": _find_state(lines, supplier_gstin),
            "email": _first_match(raw_text, EMAIL_REGEX),
            "phone": _first_match(raw_text, PHONE_REGEX),
        }
    )
    invoice["buyer"].update(
        {
            "name": buyer_name,
            "gstin": buyer_gstin,
            "address": _collect_address(lines, buyer_name),
            "state": _find_state(lines, buyer_gstin),
            "phone": _find_phone_near(lines, buyer_name),
        }
    )
    invoice["shipTo"].update(
        {
            "name": ship_name,
            "gstin": buyer_gstin if ship_name == buyer_name else "",
            "address": _collect_address(lines, ship_name),
            "state": _find_state(lines, buyer_gstin),
            "phone": _find_phone_near(lines, ship_name),
        }
    )
    invoice["invoice"].update(
        {
            "invoiceNo": _find_invoice_no(lines),
            "invoiceDate": _find_invoice_date(lines),
            "ackNo": _find_labeled_value(lines, ("ack no", "acknowledgement no")),
            "ackDate": parse_invoice_date(_find_labeled_value(lines, ("ack date",))),
            "irn": _find_labeled_value(lines, ("irn",)),
            "referenceNo": _find_labeled_value(lines, ("reference no", "ref no")),
            "placeOfSupply": _find_labeled_value(lines, ("place of supply",)),
            "destination": _find_labeled_value(lines, ("destination",)),
            "dispatchedThrough": _find_labeled_value(lines, ("dispatched through", "dispatch through")),
        }
    )


def _parse_sharon_items(lines):
    items = []
    for line in lines:
        match = re.match(
            r"^\s*(?P<line>\d+)\s+(?P<garden>.+?)\s+(?P<hsn>0902\d{2,4})\s+(?P<lot>\S+)\s+(?P<grade>[A-Z0-9]+)\s+(?P<bags>[\d.]+)\s+(?P<nett>[\d.]+)\s+(?P<sample>[\d.]+)\s+(?P<total>[\d,.]+)\s+(?P<rate>[\d,.]+)\s+(?P<amount>[\d,.]+)",
            line,
            re.I,
        )
        if not match:
            continue

        groups = match.groupdict()
        items.append(
            _item(
                line_no=int(float(groups["line"])),
                description=groups["garden"],
                garden_name=groups["garden"],
                lot=groups["lot"],
                grade=groups["grade"],
                hsn=groups["hsn"],
                bags=parse_indian_number(groups["bags"]),
                nett=parse_indian_number(groups["nett"]),
                sample=parse_indian_number(groups["sample"]),
                total_nett=parse_indian_number(groups["total"]),
                rate=parse_indian_number(groups["rate"]),
                amount=parse_indian_number(groups["amount"]),
                raw_lines=[line],
            )
        )

    return items or _parse_sharon_transposed_items(lines)


def _parse_sharon_transposed_items(lines):
    items = []
    table_start = -1
    for index, line in enumerate(lines):
        if re.search(r"\bGARDEN NAME\b|\bS\.?NO\b", line, re.I):
            table_start = index

    previous_hsn_index = table_start

    for index, line in enumerate(lines):
        if index <= table_start:
            continue
        if not HSN_REGEX.fullmatch(line.strip()):
            continue

        segment = lines[previous_hsn_index + 1 : index]
        previous_hsn_index = index
        parsed = _parse_sharon_transposed_segment(segment, line, len(items) + 1)
        if parsed:
            items.append(parsed)

    return items


def _parse_sharon_transposed_segment(segment, hsn, fallback_line_no):
    values = _segment_numbers(segment)
    amount = _largest_number(values, minimum=1000)
    if amount is None:
        return None

    math_pair = _best_amount_pair(values, amount)
    total_nett = math_pair["quantity"] if math_pair else None
    rate = math_pair["rate"] if math_pair else None
    grade = _find_grade(" ".join(segment))
    garden_line = _find_garden_line(segment, grade)
    line_no, garden_name = _split_line_no_and_name(garden_line, fallback_line_no)
    bags = _last_integer(values, maximum=100)
    nett = _first_number_between(values, 20, 50, exclude={bags, total_nett, rate})
    sample = _first_number_between(values, 0, 10, exclude={bags, total_nett, rate})
    lot = _first_integer_between(values, 100, 99999, exclude={bags, total_nett, rate, nett, sample})

    if not garden_name or not grade:
        return None

    return _item(
        line_no=line_no,
        description=garden_name,
        garden_name=garden_name,
        lot=str(int(lot)) if lot is not None else "",
        grade=grade,
        hsn=hsn,
        bags=bags,
        nett=nett,
        sample=sample,
        total_nett=total_nett,
        rate=rate,
        amount=amount,
        raw_lines=segment + [hsn],
    )


def _parse_tally_items(lines):
    items = []
    index = 0
    while index < len(lines):
        line = lines[index]
        item_start = re.match(
            r"^\s*(?P<line>\d+)\s+Tea\s+(?P<hsn>0902\d{2,4})?\s*(?P<quantity>[\d,.]+)\s*(?:kg|kgs)\s+(?P<rate>[\d,.]+)\s*(?:kg|kgs)?\s+(?P<amount>[\d,.]+)",
            line,
            re.I,
        )
        if not item_start:
            index += 1
            continue

        # Tally tea rows often put garden, grade, bag split, and lot on following lines.
        # Keep those detail lines attached until the next item or totals/tax section starts.
        raw_lines = [line]
        cursor = index + 1
        while cursor < len(lines):
            next_line = lines[cursor]
            if STOP_ITEM_REGEX.search(next_line) or re.match(r"^\s*\d+\s+Tea\b", next_line, re.I):
                break
            raw_lines.append(next_line)
            cursor += 1

        details = " ".join(raw_lines[1:]).strip()
        grade = _find_grade(details)
        lot = _find_lot(details)
        item = item_start.groupdict()
        items.append(
            _item(
                line_no=int(float(item["line"])),
                description=" ".join(part for part in ["Tea", details] if part).strip(),
                lot=lot,
                grade=grade,
                hsn=item.get("hsn") or _first_hsn(" ".join(raw_lines)),
                quantity=parse_indian_number(item["quantity"]),
                rate=parse_indian_number(item["rate"]),
                amount=parse_indian_number(item["amount"]),
                raw_lines=raw_lines,
            )
        )
        index = cursor
    return items


def _parse_tea_triangle_items(lines):
    items = []
    index = 0
    while index < len(lines):
        line = lines[index]
        match = re.match(
            r"^\s*(?P<line>\d+)\s+(?P<lot>C\d+)\s+(?P<desc>.+?)\s+(?P<hsn>0902\d{2,4})\s+(?P<quantity>[\d,.]+)\s*KGS?\s+(?P<gross>[\d,.]+)\s+(?P<rate>[\d,.]+)\s*KGS?\s+(?P<amount>[\d,.]+)",
            line,
            re.I,
        )
        if not match:
            index += 1
            continue

        # Tea Triangle puts bag count in a small continuation line like "(15 x 32)".
        # Capture it with the item row so inventory can receive bags and kg correctly.
        raw_lines = [line]
        if index + 1 < len(lines) and re.search(r"\(?\s*\d+\s*[xX*]\s*\d+", lines[index + 1]):
            raw_lines.append(lines[index + 1])
            index += 1

        groups = match.groupdict()
        bag_match = re.search(r"\(?\s*(\d+)\s*[xX*]\s*(\d+)", " ".join(raw_lines))
        items.append(
            _item(
                line_no=int(float(groups["line"])),
                description=f"{groups['lot']} {groups['desc']}",
                lot=groups["lot"],
                grade=_find_grade(groups["desc"]),
                hsn=groups["hsn"],
                bags=parse_indian_number(bag_match.group(1)) if bag_match else None,
                quantity=parse_indian_number(groups["quantity"]),
                gross_unit=parse_indian_number(groups["gross"]),
                rate=parse_indian_number(groups["rate"]),
                amount=parse_indian_number(groups["amount"]),
                raw_lines=raw_lines,
            )
        )
        index += 1
    return items


def _item(
    line_no,
    description,
    garden_name="",
    lot="",
    grade="",
    hsn="",
    bags=None,
    quantity=None,
    gross_unit=None,
    nett=None,
    sample=None,
    total_nett=None,
    rate=None,
    amount=None,
    raw_lines=None,
):
    return {
        "lineNo": line_no,
        "description": _clean_text(description),
        "gardenName": _clean_text(garden_name),
        "lotOrInvNo": _clean_text(lot),
        "grade": _find_grade(grade) or _clean_text(grade),
        "hsnCode": hsn,
        "bags": bags,
        "quantity": quantity,
        "quantityUnit": "KG",
        "grossUnit": gross_unit,
        "nett": nett,
        "sample": sample,
        "totalNett": total_nett,
        "rate": rate,
        "rateUnit": "KG",
        "amount": amount,
        "rawLines": raw_lines or [],
    }


def _fill_totals(invoice, lines):
    invoice["totals"]["totalQuantity"] = sum_number(item.get("quantity") for item in invoice["items"])
    invoice["totals"]["totalBags"] = sum_number(item.get("bags") for item in invoice["items"])
    invoice["totals"]["totalNett"] = sum_number(item.get("totalNett") for item in invoice["items"])
    invoice["totals"]["subTotal"] = sum_number(item.get("amount") for item in invoice["items"])
    invoice["totals"]["taxableValue"] = _find_amount_by_labels(lines, ("taxable value", "sub total", "subtotal")) or invoice["totals"]["subTotal"]
    invoice["totals"]["igstAmount"] = _find_amount_by_labels(lines, ("output igst", "igst"))
    invoice["totals"]["roundOff"] = _find_amount_by_labels(lines, ("round off", "rounded off"))
    invoice["totals"]["grandTotal"] = _find_amount_by_labels(lines, ("grand total", "net total", "amount payable", "total"))
    invoice["totals"]["amountInWords"] = _find_amount_words(lines)


def _fill_charges_taxes_bank_transport(invoice, lines):
    for line in lines:
        if re.search(r"(cart|coolie|freight|transport|labou?r|handling)", line, re.I):
            amount = _last_number(line)
            if amount is not None:
                invoice["charges"].append({"label": _strip_amounts(line), "amount": amount, "rawLine": line})

        if re.search(r"\b(IGST|CGST|SGST)\b", line, re.I):
            amount = _last_number(line)
            if amount is not None:
                invoice["taxes"].append({"label": _strip_amounts(line), "amount": amount, "rawLine": line})

        if re.search(r"account holder|a/c holder", line, re.I):
            invoice["bankDetails"]["accountHolder"] = _label_tail(line)
        if re.search(r"bank name", line, re.I):
            invoice["bankDetails"]["bankName"] = _label_tail(line)
        if re.search(r"account no|a/c no", line, re.I):
            invoice["bankDetails"]["accountNo"] = _label_tail(line)
        if re.search(r"\bIFSC\b", line, re.I):
            invoice["bankDetails"]["ifsc"] = _label_tail(line)
        if re.search(r"branch", line, re.I):
            invoice["bankDetails"]["branch"] = _label_tail(line)
        if re.search(r"dispatched through|transport", line, re.I):
            invoice["transport"]["name"] = invoice["transport"]["name"] or _label_tail(line)


def _clean_lines(raw_text):
    return [re.sub(r"\s+", " ", line).strip() for line in str(raw_text or "").splitlines() if line.strip()]


def _find_supplier_name(lines):
    for line in lines[:15]:
        if re.search(r"(tea|agency|emporium|company|pvt|ltd|co\.)", line, re.I) and not re.search(r"tax invoice|gstin|buyer|consignee", line, re.I):
            return _clean_text(line)
    return ""


def _find_party_name(lines, labels):
    for index, line in enumerate(lines):
        if any(label in line.lower() for label in labels):
            for candidate in lines[index + 1 : index + 5]:
                if re.search(r"[A-Za-z]", candidate) and not re.search(r"gstin|state|address", candidate, re.I):
                    return _clean_text(candidate)
    return ""


def _collect_address(lines, name):
    if not name:
        return ""
    for index, line in enumerate(lines):
        if name[:10].lower() in line.lower():
            address_lines = []
            for candidate in lines[index + 1 : index + 5]:
                if re.search(r"gstin|invoice|dated|phone|email", candidate, re.I):
                    continue
                if re.search(r"[A-Za-z]|\d{5,6}", candidate):
                    address_lines.append(_clean_text(candidate))
            return ", ".join(address_lines)
    return ""


def _find_invoice_no(lines):
    return _find_labeled_value(lines, ("invoice no", "invoice number", "voucher no", "bill no"))


def _find_invoice_date(lines):
    for line in lines:
        if re.search(r"invoice date|dated|date", line, re.I):
            parsed = parse_invoice_date(line)
            if parsed:
                return parsed
    for line in lines:
        parsed = parse_invoice_date(line)
        if parsed:
            return parsed
    return ""


def _find_labeled_value(lines, labels):
    for index, line in enumerate(lines):
        lower_line = line.lower()
        if not any(label in lower_line for label in labels):
            continue

        tail = re.split(r":|#", line, maxsplit=1)
        if len(tail) > 1 and _clean_text(tail[1]):
            return _clean_short_value(tail[1])

        parts = re.split("|".join(re.escape(label) for label in labels), line, flags=re.I)
        if len(parts) > 1 and _clean_text(parts[-1]):
            return _clean_short_value(parts[-1])

        if index + 1 < len(lines):
            return _clean_short_value(lines[index + 1])
    return ""


def _find_amount_by_labels(lines, labels):
    for line in reversed(lines):
        lower_line = line.lower()
        if any(label in lower_line for label in labels):
            value = _last_number(line)
            if value is not None:
                return value
    return None


def _find_amount_words(lines):
    for index, line in enumerate(lines):
        if "amount chargeable" in line.lower() or "amount in words" in line.lower():
            return _clean_text(" ".join(lines[index : index + 3]))
    return ""


def _find_grade(value):
    match = GRADE_REGEX.search(value or "")
    return match.group(1).upper() if match else ""


def _find_lot(value):
    match = re.search(r"\b[A-Z]\d{2,5}\b", value or "", re.I)
    return match.group(0).upper() if match else ""


def _first_hsn(value):
    match = HSN_REGEX.search(value or "")
    return match.group(0) if match else ""


def _find_state(lines, gstin):
    if gstin:
        return gstin[:2]
    state = _find_labeled_value(lines, ("state", "state name"))
    return state


def _find_phone_near(lines, name):
    if not name:
        return ""
    for index, line in enumerate(lines):
        if name[:8].lower() in line.lower():
            context = " ".join(lines[index : index + 6])
            return _first_match(context, PHONE_REGEX)
    return ""


def _first_match(value, pattern):
    match = pattern.search(value or "")
    return match.group(0) if match else ""


def _last_number(value):
    matches = re.findall(r"(?:-|\(-\))?\s*\d[\d,]*(?:\.\d+)?", value or "")
    if not matches:
        return None
    return parse_indian_number(matches[-1])


def _segment_numbers(lines):
    values = []
    for line in lines:
        for raw in re.findall(r"(?:-|\(-\))?\s*\d[\d,]*(?:\.\d+)?", line or ""):
            parsed = parse_indian_number(raw)
            if parsed is not None:
                values.append({"raw": raw, "value": parsed, "line": line})
    return values


def _largest_number(values, minimum=0):
    candidates = [item["value"] for item in values if item["value"] >= minimum]
    return max(candidates) if candidates else None


def _best_amount_pair(values, amount):
    numbers = [item["value"] for item in values if 10 <= item["value"] < amount]
    best = None

    for left in numbers:
        for right in numbers:
            if left == right:
                continue
            delta = abs((left * right) - amount)
            tolerance = max(amount * 0.02, 2)
            if delta > tolerance:
                continue

            quantity, rate = (left, right) if left > right else (right, left)
            if not best or delta < best["delta"]:
                best = {"quantity": quantity, "rate": rate, "delta": delta}

    return best


def _find_garden_line(segment, grade):
    ignored = re.compile(r"tax|amount|price|grade|nett|bags|sample|hsn|garden|invoice|before", re.I)
    for line in reversed(segment):
        if ignored.search(line) or HSN_REGEX.search(line) or _find_grade(line) == grade:
            continue
        if re.search(r"[A-Za-z]", line):
            return line
    return ""


def _split_line_no_and_name(value, fallback_line_no):
    match = re.match(r"^\s*(\d+)\s+(.+)$", value or "")
    if match:
        return int(match.group(1)), _clean_text(match.group(2))
    return fallback_line_no, _clean_text(value)


def _last_integer(values, maximum):
    for item in reversed(values):
        value = item["value"]
        if value <= maximum and float(value).is_integer():
            return value
    return None


def _first_integer_between(values, minimum, maximum, exclude=None):
    exclude = exclude or set()
    for item in values:
        value = item["value"]
        if minimum <= value <= maximum and float(value).is_integer() and not _excluded(value, exclude):
            return value
    return None


def _first_number_between(values, minimum, maximum, exclude=None):
    exclude = exclude or set()
    for item in values:
        value = item["value"]
        if minimum <= value <= maximum and not _excluded(value, exclude):
            return value
    return None


def _excluded(value, exclude):
    return any(candidate is not None and abs(float(value) - float(candidate)) < 0.001 for candidate in exclude)


def _strip_amounts(value):
    return _clean_text(re.sub(r"(?:-|\(-\))?\s*\d[\d,]*(?:\.\d+)?", " ", value or ""))


def _label_tail(line):
    parts = re.split(r":|-", line, maxsplit=1)
    return _clean_short_value(parts[-1] if parts else line)


def _clean_short_value(value):
    return _clean_text(re.sub(r"\b(gstin|state|date|invoice|phone)\b.*$", "", value or "", flags=re.I))


def _clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip(" :-|")


def sum_number(values):
    numbers = [float(value) for value in values if value is not None]
    return round(sum(numbers), 2) if numbers else None
