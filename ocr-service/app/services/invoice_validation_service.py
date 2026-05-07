def validate_invoice(invoice):
    warnings = []
    items = invoice.get("items", [])
    totals = invoice.get("totals", {})

    item_amount_total = _sum(item.get("amount") for item in items)
    taxable_value = totals.get("taxableValue") or totals.get("subTotal")
    igst_amount = totals.get("igstAmount")
    round_off = totals.get("roundOff") or 0
    grand_total = totals.get("grandTotal")

    if item_amount_total and taxable_value and not _close(item_amount_total, taxable_value, tolerance=2):
        warnings.append(
            f"Item amount total {item_amount_total:.2f} does not match taxable value {taxable_value:.2f}."
        )

    for item in items:
        quantity = item.get("quantity") or item.get("totalNett")
        rate = item.get("rate")
        amount = item.get("amount")
        if quantity and rate and amount and not _close(quantity * rate, amount, tolerance=max(amount * 0.02, 2)):
            warnings.append(f"Line {item.get('lineNo')} quantity x rate does not match amount.")

        if item.get("bags") and item.get("nett") and item.get("totalNett") is not None:
            expected_nett = item["bags"] * item["nett"] - (item.get("sample") or 0)
            if not _close(expected_nett, item["totalNett"], tolerance=1):
                warnings.append(f"Line {item.get('lineNo')} bags x nett - sample does not match total nett.")

    if taxable_value and igst_amount and _looks_like_igst_5(invoice):
        expected_igst = taxable_value * 0.05
        if not _close(expected_igst, igst_amount, tolerance=max(expected_igst * 0.02, 2)):
            warnings.append("IGST does not match 5% of taxable value.")

    charges_total = _sum(charge.get("amount") for charge in invoice.get("charges", []))
    tax_total = _sum(tax.get("amount") for tax in invoice.get("taxes", [])) or (igst_amount or 0)
    if taxable_value and grand_total:
        expected_grand_total = taxable_value + charges_total + tax_total + round_off
        if not _close(expected_grand_total, grand_total, tolerance=max(grand_total * 0.02, 3)):
            warnings.append("Grand total does not match taxable value plus tax, charges, and round off.")

    total_quantity = totals.get("totalQuantity")
    quantity_sum = _sum(item.get("quantity") for item in items)
    if total_quantity and quantity_sum and not _close(total_quantity, quantity_sum, tolerance=1):
        warnings.append("Total quantity does not match sum of item quantities.")

    invoice["confidence"] = {
        "overall": _overall_score(invoice, warnings),
        "header": _header_score(invoice),
        "items": _items_score(invoice),
        "totals": _totals_score(invoice),
        "warnings": warnings,
    }
    return invoice


def _overall_score(invoice, warnings):
    score = 0
    score += _header_score(invoice) * 0.35
    score += _items_score(invoice) * 0.35
    score += _totals_score(invoice) * 0.25
    score += 5 if not warnings else 0
    return max(0, min(100, round(score)))


def _header_score(invoice):
    header_fields = [
        invoice.get("supplier", {}).get("name"),
        invoice.get("supplier", {}).get("gstin"),
        invoice.get("invoice", {}).get("invoiceNo"),
        invoice.get("invoice", {}).get("invoiceDate"),
    ]
    return round(sum(1 for value in header_fields if value) / len(header_fields) * 100)


def _items_score(invoice):
    items = invoice.get("items", [])
    if not items:
        return 0

    scored = 0
    for item in items:
        fields = [item.get("description"), item.get("grade"), item.get("quantity") or item.get("totalNett"), item.get("rate"), item.get("amount")]
        scored += sum(1 for value in fields if value not in ("", None)) / len(fields)
    return round(scored / len(items) * 100)


def _totals_score(invoice):
    totals = invoice.get("totals", {})
    fields = [totals.get("taxableValue"), totals.get("grandTotal"), totals.get("igstAmount")]
    return round(sum(1 for value in fields if value is not None) / len(fields) * 100)


def _looks_like_igst_5(invoice):
    text = " ".join(tax.get("rawLine", "") for tax in invoice.get("taxes", []))
    return "5" in text or "IGST" in text.upper()


def _sum(values):
    numbers = [float(value) for value in values if value is not None]
    return round(sum(numbers), 2) if numbers else None


def _close(left, right, tolerance):
    return abs(float(left) - float(right)) <= tolerance
