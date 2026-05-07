const GSTIN_PATTERN = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/gi;
const PHONE_PATTERN = /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/;
const HSN_PATTERN = /\b0902\d{2,4}\b/;
const GST_RATE = 5;
const BUYER_GSTIN = '37ANHPK2993C1ZW';

const MONTHS = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

const INDIAN_STATE_CODES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  10: 'Bihar',
  11: 'Sikkim',
  12: 'Arunachal Pradesh',
  13: 'Nagaland',
  14: 'Manipur',
  15: 'Mizoram',
  16: 'Tripura',
  17: 'Meghalaya',
  18: 'Assam',
  19: 'West Bengal',
  20: 'Jharkhand',
  21: 'Odisha',
  22: 'Chhattisgarh',
  23: 'Madhya Pradesh',
  24: 'Gujarat',
  27: 'Maharashtra',
  29: 'Karnataka',
  30: 'Goa',
  32: 'Kerala',
  33: 'Tamil Nadu',
  36: 'Telangana',
  37: 'Andhra Pradesh',
};

const TEA_GRADES = [
  'SFTGFOP1',
  'SFTGFOP',
  'TGFOP1',
  'TGFOP',
  'BOPSM',
  'BOPF',
  'BOPL',
  'BOP1',
  'BBSP',
  'BBSM',
  'BPSM',
  'BPS',
  'BOP',
  'FBOP',
  'FOP',
  'PF1',
  'PD1',
  'PF',
  'PD',
  'BP',
  'OF',
  'OP',
  'DUST',
  'CTC',
  'LEAF',
  'STD',
  'STANDARD',
];

const GRADE_PATTERN = new RegExp(`(?:^|[^A-Z0-9])(${TEA_GRADES.join('|')})(?=$|[^A-Z0-9])`, 'i');
const GRADE_GLOBAL_PATTERN = new RegExp(
  `(^|[^A-Z0-9])(${TEA_GRADES.join('|')})(?=$|[^A-Z0-9])`,
  'gi'
);
const BAG_SPEC_PATTERN = /(\d+(?:\.\d+)?)\s*(?:x|\*|×)\s*(\d+(?:\.\d+)?)/gi;

const STOP_LINE_PATTERN =
  /(amount chargeable|amount in words|authorised signatory|bank details|continued|declaration|round(?:ed)? off|subject to|tax amount|terms of delivery|total\s+[₹ī]|grand total|output igst|igst\b|cgst\b|sgst\b|company's|company’s|computer generated)/i;
const TABLE_HEADER_PATTERN =
  /(description of goods|sno\s+garden|sl\s+description|amount per rate|hsn\/sac|pricekg|bags\|)/i;
const RIGHT_BLOCK_LABEL_PATTERN =
  /(invoice no\.?|dated|delivery note|mode\/terms of payment|reference no\.?\s*&\s*date|other references|buyer.?s order no\.?|dispatch doc no\.?|delivery note date|dispatched through|destination|terms of delivery)/i;
const INVOICE_CHARGE_PATTERN =
  /\b(cart(?:age)?|cool(?:ie|y)|freight(?:\s+charges?)?|transport(?:ation)?\s+charges?|hamali|labou?r(?:\s+charges?)?|loading(?:\s+charges?)?|unloading(?:\s+charges?)?|handling\s+charges?|misc(?:ellaneous)?\s+charges?)\b/i;

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function makeDraftId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
}

export function createEmptyInvoiceLine() {
  return {
    id: makeDraftId('LINE'),
    teaName: '',
    grade: '',
    bagCount: '',
    bagWeightKg: '',
    bagBreakdown: '',
    parentLineId: '',
    hsn: '',
    quantity: '',
    unit: 'Bags',
    unitWeightKg: '1',
    receivedKg: '',
    ratePerKg: '',
    taxableValue: '',
    gstRate: '',
    cgstRate: '',
    cgstAmount: '',
    sgstRate: '',
    sgstAmount: '',
    igstRate: '',
    igstAmount: '',
    lineTotal: '',
    reorderKg: '50',
    confidence: 0,
  };
}

export function createEmptyInvoiceCharge() {
  return {
    id: makeDraftId('CHG'),
    label: '',
    category: 'Miscellaneous',
    amount: '',
    allocationMethod: 'By kg',
    includeInLandedCost: true,
  };
}

export function createEmptyInvoiceDraft(options = {}) {
  return {
    id: makeDraftId('DRAFT'),
    sourceName: options.sourceName || '',
    sourceType: options.sourceType || 'Manual',
    pageCount: options.pageCount || 0,
    extractionMode: options.extractionMode || 'Manual',
    extractedAt: isoToday(),
    confidence: 0,
    vendor: {
      name: '',
      address: '',
      gstin: '',
      phone: '',
      state: '',
    },
    invoice: {
      number: '',
      date: options.today || isoToday(),
      type: 'Tax Invoice',
    },
    totals: {
      taxableValue: '',
      cgstAmount: '',
      sgstAmount: '',
      igstAmount: '',
      totalTaxAmount: '',
      grossTotal: '',
      netTotal: '',
      miscChargesTotal: '',
      roundOff: '',
    },
    charges: [],
    items: [createEmptyInvoiceLine()],
    rawText: '',
    extractionMetadata: {
      teaProductCount: 0,
      lineItemsConfidence: [],
      gstType: '',
      duplicateRowsSkipped: 0,
    },
  };
}

export function parseTeaInvoiceText(text, meta = {}) {
  const normalizedText = normalizeText(text);
  const lines = normalizeLines(normalizedText);
  const itemResult = parseTeaLineItems(lines);
  const gstType = determineGstType(lines);
  const gstins = findGstins(normalizedText);
  const vendorGstin = findVendorGstin(gstins);
  const vendorName = findVendorName(lines, meta.sourceName);
  const invoiceCharges = findInvoiceCharges(lines);
  const miscChargesTotal = roundMoney(
    invoiceCharges.reduce((total, charge) => total + parseNumber(charge.amount), 0)
  );
  const taxableFromItems = roundMoney(
    itemResult.items.reduce((total, item) => total + parseNumber(item.taxableValue), 0)
  );
  const explicitTaxable = findTaxableSummaryValue(lines);
  const taxableValue = explicitTaxable || taxableFromItems || findAmountByLabels(lines, [
    'taxable value',
    'taxable total',
    'basic value',
  ]);
  const roundOff = findRoundOff(lines);
  const netTotal = findNetTotal(lines);
  const gstAmounts = findGstAmounts(lines, taxableValue, netTotal, roundOff, miscChargesTotal);
  const draft = createEmptyInvoiceDraft({
    sourceName: meta.sourceName,
    sourceType: meta.sourceType,
    pageCount: meta.pageCount,
    extractionMode: meta.extractionMode,
  });

  draft.vendor = {
    name: vendorName,
    address: findVendorAddress(lines, vendorName),
    gstin: vendorGstin,
    phone: findVendorPhone(lines),
    state: inferStateFromGstin(vendorGstin),
  };

  draft.invoice = {
    number: findInvoiceNumber(lines),
    date: findInvoiceDate(lines, meta.sourceName) || isoToday(),
    type: /proforma/i.test(normalizedText) ? 'Proforma Invoice' : 'Tax Invoice',
  };

  draft.totals = {
    taxableValue: valueOrBlank(taxableValue),
    cgstAmount: valueOrBlank(gstAmounts.cgstAmount),
    sgstAmount: valueOrBlank(gstAmounts.sgstAmount),
    igstAmount: valueOrBlank(gstAmounts.igstAmount),
    totalTaxAmount: valueOrBlank(
      gstAmounts.cgstAmount + gstAmounts.sgstAmount + gstAmounts.igstAmount
    ),
    grossTotal: valueOrBlank(taxableValue + miscChargesTotal),
    netTotal: valueOrBlank(
      netTotal || taxableValue + miscChargesTotal + gstAmounts.totalTaxAmount + roundOff
    ),
    miscChargesTotal: valueOrBlank(miscChargesTotal),
    roundOff: valueOrBlank(roundOff),
  };

  draft.charges = invoiceCharges;
  draft.items = itemResult.items.length ? itemResult.items : [createEmptyInvoiceLine()];
  draft.rawText = normalizedText.trim();
  draft.extractionMetadata = {
    teaProductCount: itemResult.items.filter((item) => item.grade && item.receivedKg).length,
    lineItemsConfidence: itemResult.items.map((item) => item.confidence || 0),
    gstType,
    duplicateRowsSkipped: itemResult.duplicateRowsSkipped,
  };
  draft.confidence = scoreTeaExtraction({
    vendorName,
    vendorGstin,
    invoiceNumber: draft.invoice.number,
    invoiceDate: draft.invoice.date,
    items: itemResult.items,
    netTotal: parseNumber(draft.totals.netTotal),
    taxableValue,
  });

  return draft;
}

export function parseTeaLineItems(lines) {
  const items = [];
  const seen = new Set();
  let duplicateRowsSkipped = 0;
  let inTable = false;
  let pendingDescriptions = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (TABLE_HEADER_PATTERN.test(line)) {
      inTable = true;
      pendingDescriptions = [];
      continue;
    }

    if (!inTable && !looksLikeStandaloneItem(line)) {
      continue;
    }

    if (isIgnorableLine(line)) {
      pendingDescriptions = [];
      continue;
    }

    const tallyResult = parseTallyTeaRow(line, lines.slice(index + 1, index + 5));
    if (tallyResult) {
      index += tallyResult.consumed;
      pendingDescriptions = [];
      ({ duplicateRowsSkipped } = addUniqueItems(
        items,
        seen,
        tallyResult.items,
        duplicateRowsSkipped
      ));
      continue;
    }

    const sharonItem = parseSharonRow(line);
    if (sharonItem) {
      pendingDescriptions = [];
      ({ duplicateRowsSkipped } = addUniqueItem(items, seen, sharonItem, duplicateRowsSkipped));
      continue;
    }

    const compactResult = parseCompactTeaRow(line, {
      pendingDescriptions,
      followingLine: lines[index + 1] || '',
    });

    if (compactResult) {
      if (compactResult.consumedNextLine) {
        index += 1;
      }

      pendingDescriptions = [];
      ({ duplicateRowsSkipped } = addUniqueItems(
        items,
        seen,
        compactResult.items,
        duplicateRowsSkipped
      ));
      continue;
    }

    if (isPendingDescriptionLine(line)) {
      pendingDescriptions = [...pendingDescriptions, line].slice(-3);
    } else {
      pendingDescriptions = [];
    }
  }

  return {
    items,
    duplicateRowsSkipped,
  };
}

export function buildTeaLineItem(line) {
  const compact = parseCompactTeaRow(line, { pendingDescriptions: [], followingLine: '' });
  if (compact) return compact.items[0];

  const sharon = parseSharonRow(line);
  if (sharon) return sharon;

  const description = parseTeaDescription(line);
  const bagSummary = summarizeBagSpecs(description.bagSpecs);
  const numbers = getNumberTokens(line)
    .filter((token) => !token.isPercent && !isHsnToken(token))
    .map((token) => token.value);
  const quantity = bagSummary.bagCount || numbers[0] || 0;
  const receivedKg = bagSummary.receivedKg || quantity * (bagSummary.bagWeightKg || 1);
  const ratePerKg = numbers[1] || 0;
  const taxableValue = numbers[2] || receivedKg * ratePerKg;

  return createLineItemsForBagGroups({
    teaName: description.teaName || 'Tea',
    grade: description.grade,
    bagSummary,
    quantity,
    receivedKg,
    ratePerKg,
    taxableValue,
    gstType: 'IGST',
  })[0];
}

function parseTallyTeaRow(line, followingLines) {
  if (!/^\s*\d+\s+tea\b/i.test(line) || !/\bkgs?\b/i.test(line)) {
    return null;
  }

  const rowWithoutSerial = line.replace(/^\s*\d+\s+tea\b/i, '').trim();
  const values = getNumberTokens(rowWithoutSerial)
    .filter((token) => !token.isPercent && !isHsnToken(token))
    .map((token) => token.value);
  const rowNumbers = interpretTeaRowValues(values);

  if (!rowNumbers) {
    return null;
  }

  const detailLines = [];
  let consumed = 0;

  for (const detailLine of followingLines) {
    if (!detailLine || isNewItemStart(detailLine) || STOP_LINE_PATTERN.test(detailLine)) {
      break;
    }

    if (TABLE_HEADER_PATTERN.test(detailLine) || /^no\.?$/i.test(detailLine)) {
      consumed += 1;
      continue;
    }

    consumed += 1;

    if (isDetailLine(detailLine)) {
      detailLines.push(detailLine);
    }

    if (detailLines.some((value) => hasBagSpec(value) || findGrade(value))) {
      break;
    }
  }

  const detailText = detailLines.join(' ') || 'Tea';
  const description = parseTeaDescription(detailText);
  const bagSummary = summarizeBagSpecs(description.bagSpecs);
  const quantity = bagSummary.bagCount || rowNumbers.receivedKg;
  const receivedKg = bagSummary.receivedKg || rowNumbers.receivedKg;

  return {
    consumed,
    items: createLineItemsForBagGroups({
      teaName: description.teaName || 'Tea',
      grade: description.grade,
      bagSummary,
      quantity,
      receivedKg,
      ratePerKg: rowNumbers.ratePerKg,
      taxableValue: rowNumbers.taxableValue,
      gstType: 'IGST',
    }),
  };
}

function parseCompactTeaRow(line, options) {
  const pendingDescriptions = options.pendingDescriptions || [];
  const followingLine = options.followingLine || '';
  const consumedNextLine = isBagSpecOnlyLine(followingLine);
  const bagLine = consumedNextLine ? followingLine : '';
  const startsWithAmount = /^\s*(?:₹|rs\.?|inr|ī)?\s*\d[\d,]*\.\d{2}\s+kgs?\b/i.test(line);
  const compactMatch = line.match(
    /^(?<description>.*?)\s+(?<amount>\d[\d,]*\.\d{2})\s+(?<unit>kgs?)\s+(?<rate>\d+(?:\.\d+)?)\s+(?<gross>\d+(?:\.\d+)?)\s+(?<quantity>\d+(?:\.\d+)?)\s+kgs?\b/i
  );

  if (!compactMatch && !startsWithAmount) {
    return null;
  }

  const amountMatch = line.match(/(?:₹|rs\.?|inr|ī)?\s*(\d[\d,]*\.\d{2})\s+kgs?\b/i);
  if (!amountMatch) {
    return null;
  }

  const rowValues = getNumberTokens(line).filter((token) => !token.isPercent && !isDateToken(token));
  const amountToken = rowValues.find((token) => isSameNumber(token.value, parseNumber(amountMatch[1])));
  const afterAmount = rowValues.filter((token) => token.index > (amountToken?.index || 0));
  const descriptionText = [
    ...pendingDescriptions,
    compactMatch?.groups.description || (startsWithAmount ? '' : line.slice(0, amountToken?.index)),
    bagLine,
  ]
    .join(' ')
    .trim();
  const description = parseTeaDescription(descriptionText);
  const bagSummary = summarizeBagSpecs(description.bagSpecs);
  const quantityFromLine = compactMatch
    ? parseNumber(compactMatch.groups.quantity)
    : findQuantityBeforeUnit(line);
  const ratePerKg = compactMatch
    ? parseNumber(compactMatch.groups.rate)
    : afterAmount.find((token) => !isHsnToken(token))?.value || 0;
  const taxableValue = parseNumber(amountMatch[1]);
  const receivedKg = bagSummary.receivedKg || quantityFromLine;
  const quantity = bagSummary.bagCount || (bagSummary.bagWeightKg ? receivedKg / bagSummary.bagWeightKg : receivedKg);

  if (!description.teaName && !description.grade) {
    return null;
  }

  return {
    consumedNextLine,
    items: createLineItemsForBagGroups({
      teaName: description.teaName || 'Tea',
      grade: description.grade,
      bagSummary,
      quantity,
      receivedKg,
      ratePerKg,
      taxableValue,
      gstType: 'IGST',
    }),
  };
}

function parseSharonRow(line) {
  const grade = findGrade(line);

  if (!grade || !HSN_PATTERN.test(line) || !/^\s*\d+\s+[A-Z]/i.test(line) || /\bkgs?\b/i.test(line)) {
    return null;
  }

  const gradeIndex = line.toUpperCase().search(new RegExp(`\\b${escapeRegExp(grade)}\\b`));
  if (gradeIndex < 0) {
    return null;
  }

  const beforeGrade = line.slice(0, gradeIndex);
  const afterGrade = line.slice(gradeIndex + grade.length);
  const productPart = beforeGrade
    .replace(/^\s*\d+\s+/, '')
    .replace(HSN_PATTERN, '')
    .replace(/\b\d{2,6}\b/g, '')
    .trim();
  const values = getNumberTokens(afterGrade)
    .filter((token) => !token.isPercent)
    .map((token) => token.value);

  if (values.length < 4) {
    return null;
  }

  const bagCount = values[0];
  let bagWeightKg = values[1];
  const totalNett = values.length >= 6 ? values[3] : values.at(-3);
  const ratePerKg = values.at(-2);
  const taxableValue = values.at(-1);

  if (bagWeightKg > 100 && Math.abs(bagCount * (bagWeightKg / 10) - totalNett) < bagCount * 6) {
    bagWeightKg /= 10;
  }

  const bagSummary = {
    bagCount,
    bagWeightKg,
    receivedKg: totalNett || bagCount * bagWeightKg,
    breakdown: `${formatNumber(bagCount)} x ${formatNumber(bagWeightKg)}`,
    components: [{ count: bagCount, weightKg: bagWeightKg }],
  };

  return createLineItem({
    teaName: productPart || 'Tea',
    grade,
    bagSummary,
    quantity: bagCount,
    receivedKg: bagSummary.receivedKg,
    ratePerKg,
    taxableValue,
    gstType: 'IGST',
  });
}

function interpretTeaRowValues(values) {
  if (values.length < 3) {
    return null;
  }

  const first = values[0];
  const second = values[1];
  const third = values[2];
  const amountRateQuantity = {
    taxableValue: first,
    ratePerKg: second,
    receivedKg: third,
  };
  const quantityRateAmount = {
    taxableValue: third,
    ratePerKg: second,
    receivedKg: first,
  };
  const firstScore = rowMathScore(amountRateQuantity);
  const secondScore = rowMathScore(quantityRateAmount);

  if (firstScore <= secondScore) {
    return amountRateQuantity;
  }

  return quantityRateAmount;
}

function rowMathScore(row) {
  const expected = row.receivedKg * row.ratePerKg;
  const tolerance = Math.max(Math.abs(row.taxableValue) * 0.015, 1);
  const delta = Math.abs(expected - row.taxableValue);

  return delta <= tolerance ? delta : delta + tolerance * 100;
}

function createLineItemsForBagGroups({
  teaName,
  grade,
  bagSummary,
  quantity,
  receivedKg,
  ratePerKg,
  taxableValue,
  gstType,
}) {
  if (bagSummary.components.length <= 1) {
    return [
      createLineItem({
        teaName,
        grade,
        bagSummary,
        quantity,
        receivedKg,
        ratePerKg,
        taxableValue,
        gstType,
      }),
    ];
  }

  const parentLineId = makeDraftId('SRC');

  return bagSummary.components.map((component) => {
    const componentBagSummary = summarizeBagSpecs([component]);
    const componentReceivedKg = componentBagSummary.receivedKg;
    const componentTaxableValue =
      ratePerKg > 0
        ? roundMoney(componentReceivedKg * ratePerKg)
        : roundMoney(taxableValue * (componentReceivedKg / Math.max(receivedKg, 1)));

    return createLineItem({
      teaName,
      grade,
      bagSummary: componentBagSummary,
      quantity: component.count,
      receivedKg: componentReceivedKg,
      ratePerKg,
      taxableValue: componentTaxableValue,
      gstType,
      parentLineId,
    });
  });
}

function createLineItem({
  teaName,
  grade,
  bagSummary,
  quantity,
  receivedKg,
  ratePerKg,
  taxableValue,
  gstType,
  parentLineId = '',
}) {
  const taxAmounts = calculateLineTax(taxableValue, gstType);
  const confidence = calculateLineConfidence({
    teaName,
    grade,
    bagSummary,
    quantity,
    receivedKg,
    ratePerKg,
    taxableValue,
  });

  return {
    ...createEmptyInvoiceLine(),
    teaName: cleanTeaName(teaName) || 'Tea',
    grade: normalizeGrade(grade),
    bagCount: valueOrBlank(bagSummary.bagCount),
    bagWeightKg: valueOrBlank(bagSummary.bagWeightKg),
    bagBreakdown: bagSummary.breakdown || '',
    parentLineId,
    hsn: '',
    quantity: valueOrBlank(quantity),
    unit: 'Bags',
    unitWeightKg: valueOrBlank(bagSummary.bagWeightKg || (quantity > 0 ? receivedKg / quantity : 1)),
    receivedKg: valueOrBlank(receivedKg),
    ratePerKg: valueOrBlank(ratePerKg),
    taxableValue: valueOrBlank(taxableValue),
    gstRate: valueOrBlank(GST_RATE),
    cgstRate: valueOrBlank(taxAmounts.cgstRate),
    cgstAmount: valueOrBlank(taxAmounts.cgstAmount),
    sgstRate: valueOrBlank(taxAmounts.sgstRate),
    sgstAmount: valueOrBlank(taxAmounts.sgstAmount),
    igstRate: valueOrBlank(taxAmounts.igstRate),
    igstAmount: valueOrBlank(taxAmounts.igstAmount),
    lineTotal: valueOrBlank(taxableValue + taxAmounts.totalTaxAmount),
    confidence,
  };
}

function parseTeaDescription(value) {
  const bagSpecs = extractBagSpecs(value);
  const grade = findGrade(value);
  const teaName = cleanTeaName(
    String(value || '')
      .replace(BAG_SPEC_PATTERN, ' ')
      .replace(HSN_PATTERN, ' ')
      .replace(GRADE_GLOBAL_PATTERN, '$1 ')
      .replace(/\b\d[\d,]*(?:\.\d+)?\b/g, ' ')
  );

  return {
    teaName,
    grade,
    bagSpecs,
  };
}

function cleanTeaName(value) {
  return String(value || '')
    .replace(/[()]/g, ' ')
    .replace(/^\s*\d+\s+/, '')
    .replace(/\btea\b$/i, '')
    .replace(/^[A-Z]{1,4}\/?\d+(?:\/\d+)*(?:\/\d{4})?\s+/i, '')
    .replace(/^[A-Z]{1,4}\d{2,6}\s+/i, '')
    .replace(/^[A-Z]{1,4}(?:\s*\/\s*)+\s*/i, '')
    .replace(/^[|:;.,()[\]\s-]+|[|:;.,()[\]\s-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBagSpecs(value) {
  const specs = [];
  BAG_SPEC_PATTERN.lastIndex = 0;

  for (const match of String(value || '').matchAll(BAG_SPEC_PATTERN)) {
    const count = parseNumber(match[1]);
    const weightKg = parseNumber(match[2]);

    if (count > 0 && weightKg > 0 && count < 1000 && weightKg < 1000) {
      specs.push({ count, weightKg });
    }
  }

  return specs;
}

function summarizeBagSpecs(specs) {
  if (!specs.length) {
    return {
      bagCount: 0,
      bagWeightKg: 0,
      receivedKg: 0,
      breakdown: '',
      components: [],
    };
  }

  const bagCount = roundMoney(specs.reduce((total, spec) => total + spec.count, 0));
  const receivedKg = roundMoney(
    specs.reduce((total, spec) => total + spec.count * spec.weightKg, 0)
  );
  const bagWeightKg = bagCount > 0 ? roundMoney(receivedKg / bagCount) : specs[0].weightKg;

  return {
    bagCount,
    bagWeightKg,
    receivedKg,
    breakdown: specs.map((spec) => `${formatNumber(spec.count)} x ${formatNumber(spec.weightKg)}`).join(', '),
    components: specs,
  };
}

function calculateLineTax(taxableValue, gstType) {
  const taxable = parseNumber(taxableValue);

  if (!taxable) {
    return {
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      totalTaxAmount: 0,
    };
  }

  if (gstType === 'CGST/SGST') {
    const splitAmount = roundMoney(taxable * (GST_RATE / 2 / 100));

    return {
      cgstRate: GST_RATE / 2,
      cgstAmount: splitAmount,
      sgstRate: GST_RATE / 2,
      sgstAmount: splitAmount,
      igstRate: 0,
      igstAmount: 0,
      totalTaxAmount: roundMoney(splitAmount * 2),
    };
  }

  const igstAmount = roundMoney(taxable * (GST_RATE / 100));

  return {
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: GST_RATE,
    igstAmount,
    totalTaxAmount: igstAmount,
  };
}

function determineGstType(lines) {
  const text = lines.join(' ').toLowerCase();
  const hasIgst = /\bigst\b/.test(text);
  const hasCgst = /\bcgst\b/.test(text);
  const hasSgst = /\bsgst\b/.test(text);

  if (hasCgst || hasSgst) return 'CGST/SGST';
  if (hasIgst) return 'IGST';

  return 'IGST';
}

function findGstAmounts(lines, taxableValue, netTotal, roundOff, miscChargesTotal = 0) {
  const gstType = determineGstType(lines);
  const explicitIgst = findTaxAmountByLabel(lines, ['igst', 'output igst', 'integrated tax']);
  const explicitCgst = findTaxAmountByLabel(lines, ['cgst', 'central tax']);
  const explicitSgst = findTaxAmountByLabel(lines, ['sgst', 'state tax']);
  const inferredTax = roundMoney(
    Math.max(
      parseNumber(netTotal) - parseNumber(taxableValue) - parseNumber(miscChargesTotal) - roundOff,
      0
    )
  );
  const defaultTax = roundMoney(parseNumber(taxableValue) * (GST_RATE / 100));

  if (gstType === 'CGST/SGST') {
    const cgstAmount = explicitCgst || roundMoney((inferredTax || defaultTax) / 2);
    const sgstAmount = explicitSgst || roundMoney((inferredTax || defaultTax) / 2);

    return {
      cgstAmount,
      sgstAmount,
      igstAmount: 0,
      totalTaxAmount: roundMoney(cgstAmount + sgstAmount),
    };
  }

  const igstAmount = explicitIgst || (inferredTax > 0 ? inferredTax : defaultTax);

  return {
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: roundMoney(igstAmount),
    totalTaxAmount: roundMoney(igstAmount),
  };
}

function findTaxAmountByLabel(lines, labels) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const lowerLine = lines[index].toLowerCase();

    if (!labels.some((label) => lowerLine.includes(label))) {
      continue;
    }

    const values = getNumberTokens(lines[index])
      .filter((token) => !isHsnToken(token))
      .map((token) => token.value)
      .filter((value) => value > 100);

    if (values.length) {
      return values.reduce((largest, value) => (value > largest ? value : largest), 0);
    }
  }

  return 0;
}

function findInvoiceCharges(lines) {
  return lines
    .filter((line) => INVOICE_CHARGE_PATTERN.test(line))
    .map((line) => {
      const values = getNumberTokens(line)
        .filter((token) => !token.isPercent && !isHsnToken(token))
        .map((token) => token.value)
        .filter((value) => value > 0);
      const amount = values.at(-1) || 0;

      if (!amount) {
        return null;
      }

      const label = cleanChargeLabel(line);

      return {
        ...createEmptyInvoiceCharge(),
        label,
        category: categorizeCharge(label),
        amount: valueOrBlank(amount),
      };
    })
    .filter(Boolean);
}

function cleanChargeLabel(line) {
  const cleaned = String(line || '')
    .replace(/(?:₹|rs\.?|inr|ī)?\s*-?\d[\d,]*(?:\.\d+)?(?:\s*%)?/gi, ' ')
    .replace(/[|:;.,()[\]-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || 'Miscellaneous charge';
}

function categorizeCharge(label) {
  if (/(cart|freight|transport|cartage)/i.test(label)) {
    return /cool(?:ie|y)|labou?r|hamali|handling|loading|unloading/i.test(label)
      ? 'Cart & Coolie'
      : 'Transport';
  }

  if (/cool(?:ie|y)|labou?r|hamali|handling|loading|unloading/i.test(label)) {
    return 'Labour & Handling';
  }

  return 'Miscellaneous';
}

function findTaxableSummaryValue(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const nearbyHeader = lines
      .slice(Math.max(index - 5, 0), index)
      .join(' ')
      .toLowerCase();

    if (!/^total\b/i.test(line) || !nearbyHeader.includes('taxable')) {
      continue;
    }

    const values = getNumberTokens(line)
      .filter((token) => !token.isPercent && !isHsnToken(token))
      .map((token) => token.value);

    if (
      values.length >= 3 &&
      /(taxable\s+(?:igst|cgst|sgst)|value\s+rate\s+amount)/.test(nearbyHeader)
    ) {
      return values[0];
    }

    if (values.length >= 3 && /(?:igst|cgst|sgst)\s+taxable/.test(nearbyHeader)) {
      return values.at(-1);
    }

    if (values.length >= 2) {
      return values.at(-1);
    }
  }

  return 0;
}

function findNetTotal(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (!/(grand total|net total|invoice total|amount payable|^total\b)/i.test(line)) {
      continue;
    }

    if (/tax amount|taxable|hsn\/sac/i.test(`${lines[index - 2] || ''} ${lines[index - 1] || ''}`)) {
      continue;
    }

    const values = getNumberTokens(line)
      .filter((token) => !token.isPercent && !isHsnToken(token))
      .map((token) => token.value)
      .filter((value) => value > 100);

    if (!values.length) {
      continue;
    }

    if (/\bkgs?\b/i.test(line)) {
      return values.reduce((largest, value) => (value > largest ? value : largest), 0);
    }

    return values.at(-1);
  }

  return 0;
}

function findRoundOff(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];

    if (!/round(?:ed)? off/i.test(line)) {
      continue;
    }

    const token = getNumberTokens(line).at(-1);
    let value = token?.value || 0;

    if (value > 10 && value < 1000 && token && !/\./.test(token.raw)) {
      value /= 100;
    }

    const isNegative = /\(-\)|-\)|less|-/i.test(line);
    return roundMoney(isNegative ? -value : value);
  }

  return 0;
}

function findAmountByLabels(lines, labels) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].toLowerCase();

    if (!labels.some((label) => line.includes(label))) {
      continue;
    }

    const values = getNumberTokens(lines[index])
      .filter((token) => !token.isPercent && !isHsnToken(token))
      .map((token) => token.value)
      .filter((value) => Number.isFinite(value));

    if (values.length) {
      return values.at(-1);
    }
  }

  return 0;
}

function findVendorName(lines, sourceName) {
  const accountName = findLabeledValue(lines, [/^a\/c holder(?:'|’)?s name/i]);
  const beforeBuyer = lines.slice(0, firstBuyerBlockIndex(lines));
  const headerName = beforeBuyer
    .map((line) => cleanBusinessName(removeRightBlockText(line)))
    .find((line) => {
      return (
        /[a-z]/i.test(line) &&
        /(tea|agency|emporium|company|\bco\b|pvt|ltd)/i.test(line) &&
        !/(tax invoice|proforma invoice|e-invoice|irn|ack)/i.test(line)
      );
    });

  if (headerName) {
    return headerName;
  }

  const businessLine = beforeBuyer.find((line) => {
    return (
      /[a-z]/i.test(line) &&
      cleanBusinessName(line).length > 4 &&
      !/^[a-f0-9-]{16,}$/i.test(line) &&
      !/(tax invoice|proforma invoice|e-invoice|irn|ack|gstin|state name|contact|e-mail|fssai|tmco|invoice no|date)/i.test(
        line
      ) &&
      !/^\W+$/.test(line)
    );
  });

  if (businessLine) {
    return cleanBusinessName(businessLine);
  }

  if (accountName) {
    return cleanBusinessName(accountName);
  }

  const fileSupplier = inferSupplierFromFileName(sourceName);
  return fileSupplier || '';
}

function findVendorAddress(lines, vendorName) {
  const buyerIndex = firstBuyerBlockIndex(lines);
  const vendorIndex = vendorName
    ? lines.findIndex((line) => line.toLowerCase().includes(vendorName.toLowerCase().slice(0, 12)))
    : -1;
  const startIndex = vendorIndex >= 0 ? vendorIndex + 1 : 0;
  const addressLines = [];

  for (let index = startIndex; index < Math.min(lines.length, buyerIndex, startIndex + 6); index += 1) {
    const line = cleanVendorAddressLine(lines[index]);

    if (/(gstin|state name|contact|e-mail|fssai|tmco|temco|invoice|tax invoice|proforma)/i.test(line)) {
      continue;
    }

    if (/[a-z]/i.test(line) || /\d{5,6}/.test(line)) {
      addressLines.push(line);
    }
  }

  return addressLines.join(', ');
}

function findVendorGstin(gstins) {
  return gstins.find((gstin) => gstin !== BUYER_GSTIN) || gstins[0] || '';
}

function findVendorPhone(lines) {
  const buyerIndex = firstBuyerBlockIndex(lines);

  for (const line of lines.slice(0, buyerIndex)) {
    if (!/(phone|mobile|contact|tel)/i.test(line)) {
      continue;
    }

    const phone = findFirstMatch(line, PHONE_PATTERN);

    if (phone) {
      return phone;
    }
  }

  return '';
}

function findGstins(text) {
  return [...new Set(Array.from(String(text || '').matchAll(GSTIN_PATTERN)).map((match) => match[0].toUpperCase()))];
}

function inferStateFromGstin(gstin) {
  const stateCode = String(gstin || '').slice(0, 2);
  return INDIAN_STATE_CODES[stateCode] || '';
}

function findInvoiceNumber(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^(?:.*\b)?(?:invoice|voucher|bill)\s*(?:no|number|#)?\.?\b/i.test(lines[index])) {
      continue;
    }

    const context = [lines[index], lines[index + 1] || '', lines[index + 2] || ''].join(' ');
    const candidate = extractInvoiceNumberCandidate(context);

    if (candidate) {
      return candidate;
    }
  }

  return '';
}

function extractInvoiceNumberCandidate(value) {
  const text = String(value || '');
  const patterns = [
    /\b[A-Z]{2,5}\/[A-Z0-9/-]*\d+[A-Z0-9/-]*\/\d{4}-\d{2}\b/i,
    /\b[A-Z]{2,5}\d{2,}\/\d{4}-\d{2}\b/i,
    /\bPI\d+\b/i,
    /\bSTA\/\d{2}-\d{2}\/\d+\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return match[0].toUpperCase();
    }
  }

  const inline = text.match(/(?:invoice|voucher|bill)\s*(?:no|number|#)?\.?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{1,})/i);
  const inlineValue = inline?.[1]
    ?.replace(/\b(?:dated|delivery|mode|terms|note)\b.*$/i, '')
    .trim();

  return inlineValue && /[0-9]/.test(inlineValue) ? inlineValue.toUpperCase() : '';
}

function findInvoiceDate(lines, sourceName) {
  const invoiceDateLine = lines.find((line) => /invoice\s*date/i.test(line));
  const invoiceDate = toIsoDate(invoiceDateLine);

  if (invoiceDate) {
    return invoiceDate;
  }

  const directValue = findLabeledValue(lines, [
    /^invoice\s*date/i,
    /^bill\s*date/i,
    /^dated$/i,
    /^date$/i,
  ]);
  const directDate = toIsoDate(directValue);

  if (directDate) {
    return directDate;
  }

  for (const line of lines) {
    const date = toIsoDate(line);

    if (date && !/ack date/i.test(line)) {
      return date;
    }
  }

  return toIsoDate(sourceName);
}

function findLabeledValue(lines, patterns) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const pattern of patterns) {
      if (!pattern.test(line)) continue;

      const inlineValue = cleanShortValue(line.replace(pattern, '').replace(/^[\s:#/-]+/, ''));

      if (inlineValue) {
        return inlineValue;
      }

      for (let offset = 1; offset <= 2; offset += 1) {
        const nextLine = lines[index + offset];

        if (nextLine && !TABLE_HEADER_PATTERN.test(nextLine) && !STOP_LINE_PATTERN.test(nextLine)) {
          return cleanShortValue(nextLine);
        }
      }
    }
  }

  return '';
}

function cleanShortValue(value) {
  const cleaned = String(value || '')
    .replace(/\s+(date|gstin|gst no|phone|mobile|state|place of supply)\s*[:#/-].*$/i, '')
    .replace(/^[\s:#/.-]+/, '')
    .trim();

  return /[A-Za-z0-9]/.test(cleaned) ? cleaned : '';
}

function cleanBusinessName(value) {
  return String(value || '')
    .replace(/^[^A-Z0-9]*(?:AP\s+)?/i, '')
    .replace(/\s*\(\d{4}-\d{2,4}\)\s*$/i, '')
    .replace(RIGHT_BLOCK_LABEL_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanVendorAddressLine(line) {
  return removeRightBlockText(line)
    .replace(/\s+\bPI\d+\b.*$/i, '')
    .replace(/\s+\b[A-Z]{2,5}\/[A-Z0-9/-]+\/\d{4}-\d{2}\b.*$/i, '')
    .replace(/\s+\b[A-Z]{2,5}\/\d+\/\d{4}-\d{2}\b.*$/i, '')
    .replace(/\s+\b\d{1,2}[-/][A-Za-z]{3,9}[-/]\d{2,4}\b.*$/i, '')
    .replace(/\s+\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeRightBlockText(line) {
  return String(line || '').split(RIGHT_BLOCK_LABEL_PATTERN)[0].trim();
}

function inferSupplierFromFileName(sourceName) {
  const parts = String(sourceName || '')
    .replace(/\.[^.]+$/, '')
    .split('_')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2 && /siva sai/i.test(parts[0])) {
    return parts[1];
  }

  return parts[0] || '';
}

function firstBuyerBlockIndex(lines) {
  const index = lines.findIndex((line) => /(consignee|buyer|bill to party|bill to)/i.test(line));
  return index >= 0 ? index : lines.length;
}

function normalizeLines(text) {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[₹]/g, '₹')
    .replace(/\u00a0/g, ' ');
}

function getNumberTokens(value) {
  const text = String(value || '');
  const tokens = [];
  const pattern = /(?:₹|rs\.?|inr|ī)?\s*-?\d[\d,]*(?:\.\d+)?(?:\s*%)?/gi;

  for (const match of text.matchAll(pattern)) {
    const index = match.index || 0;
    const raw = match[0];
    const numberOffset = Math.max(raw.search(/\d/), 0);
    const tokenStart = index + numberOffset;
    const before = text[tokenStart - 1] || '';
    const after = text[index + raw.length] || '';

    if (/[A-Z]/i.test(before) || /[A-Z]/i.test(after) || before === '/' || after === '/') {
      continue;
    }

    tokens.push({
      raw,
      value: parseNumber(raw),
      index,
      endIndex: index + raw.length,
      isPercent: /%/.test(raw),
    });
  }

  return tokens;
}

function cleanNumberText(value) {
  return String(value || '')
    .replace(/[|)]/g, '')
    .replace(/[^0-9.%-]/g, '');
}

function parseNumber(value) {
  const parsedValue = Number(cleanNumberText(value).replace(/%/g, ''));
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function toIsoDate(value) {
  const text = String(value || '');
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);

  if (numeric) {
    const day = numeric[1].padStart(2, '0');
    const month = numeric[2].padStart(2, '0');
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];

    if (isValidDateParts(day, month, year)) {
      return `${year}-${month}-${day}`;
    }
  }

  const monthName = text.match(/\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})\b/);

  if (monthName) {
    const day = monthName[1].padStart(2, '0');
    const month = MONTHS[monthName[2].toLowerCase()];
    const year = monthName[3].length === 2 ? `20${monthName[3]}` : monthName[3];

    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  const fileDate = text.match(/\b(\d{2})_(\d{2})_(\d{2,4})\b/);

  if (fileDate) {
    const day = fileDate[1];
    const month = fileDate[2];
    const year = fileDate[3].length === 2 ? `20${fileDate[3]}` : fileDate[3];

    if (isValidDateParts(day, month, year)) {
      return `${year}-${month}-${day}`;
    }
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return iso ? iso[0] : '';
}

function isValidDateParts(day, month, year) {
  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);

  return (
    Number.isInteger(dayNumber) &&
    Number.isInteger(monthNumber) &&
    Number.isInteger(yearNumber) &&
    dayNumber >= 1 &&
    dayNumber <= 31 &&
    monthNumber >= 1 &&
    monthNumber <= 12 &&
    yearNumber >= 2000 &&
    yearNumber <= 2100
  );
}

function findFirstMatch(text, pattern) {
  return text.match(pattern)?.[0]?.trim() || '';
}

function findGrade(value) {
  return normalizeGrade(String(value || '').match(GRADE_PATTERN)?.[1] || '');
}

function normalizeGrade(value) {
  return String(value || '').toUpperCase();
}

function isHsnToken(token) {
  return HSN_PATTERN.test(cleanNumberText(token.raw));
}

function isDateToken(token) {
  return /[-/]/.test(token.raw);
}

function isSameNumber(left, right) {
  return Math.abs(parseNumber(left) - parseNumber(right)) < 0.001;
}

function findQuantityBeforeUnit(line) {
  const matches = Array.from(String(line || '').matchAll(/(\d+(?:\.\d+)?)\s+kgs?\b/gi));
  return matches.length ? parseNumber(matches.at(-1)[1]) : 0;
}

function looksLikeStandaloneItem(line) {
  return /^\s*\d+\s+tea\b/i.test(line) || (HSN_PATTERN.test(line) && findGrade(line));
}

function isIgnorableLine(line) {
  return (
    !line ||
    /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line) ||
    /^no\.?$/i.test(line) ||
    /^continued/i.test(line) ||
    (/^(tax invoice|proforma invoice)/i.test(line) && /page/i.test(line))
  );
}

function isPendingDescriptionLine(line) {
  return (
    /[a-z]/i.test(line) &&
    !TABLE_HEADER_PATTERN.test(line) &&
    !STOP_LINE_PATTERN.test(line) &&
    !/^(tax invoice|proforma invoice|invoice no|dated|mode\/terms|buyer|consignee|gstin|state name)/i.test(line) &&
    getNumberTokens(line).filter((token) => !token.isPercent).length <= 2
  );
}

function isDetailLine(line) {
  return /[a-z]/i.test(line) || hasBagSpec(line) || findGrade(line);
}

function isNewItemStart(line) {
  return /^\s*\d+\s+(?:tea\b|[A-Z])/i.test(line) && (HSN_PATTERN.test(line) || /\bkgs?\b/i.test(line));
}

function hasBagSpec(line) {
  BAG_SPEC_PATTERN.lastIndex = 0;
  return BAG_SPEC_PATTERN.test(line);
}

function isBagSpecOnlyLine(line) {
  return /^\s*\(?\s*\d+(?:\.\d+)?\s*(?:x|\*|×)\s*\d+(?:\.\d+)?/i.test(line || '');
}

function addUniqueItems(items, seen, nextItems, duplicateRowsSkipped) {
  let nextDuplicateRowsSkipped = duplicateRowsSkipped;

  for (const item of nextItems) {
    ({ duplicateRowsSkipped: nextDuplicateRowsSkipped } = addUniqueItem(
      items,
      seen,
      item,
      nextDuplicateRowsSkipped
    ));
  }

  return { duplicateRowsSkipped: nextDuplicateRowsSkipped };
}

function addUniqueItem(items, seen, item, duplicateRowsSkipped) {
  const signature = itemSignature(item);
  const previousSignature = items.length ? itemSignature(items.at(-1)) : '';

  if (seen.has(signature) && (previousSignature !== signature || duplicateRowsSkipped > 0)) {
    return { duplicateRowsSkipped: duplicateRowsSkipped + 1 };
  }

  seen.add(signature);
  items.push(item);
  return { duplicateRowsSkipped };
}

function itemSignature(item) {
  return [
    item.teaName,
    item.grade,
    item.quantity,
    item.receivedKg,
    item.ratePerKg,
    item.taxableValue,
    item.bagBreakdown,
  ]
    .join('|')
    .toLowerCase();
}

function calculateLineConfidence(fields) {
  let score = 0;

  if (fields.teaName) score += 20;
  if (fields.grade) score += 20;
  if (fields.bagSummary?.bagCount && fields.bagSummary?.receivedKg) score += 20;
  if (parseNumber(fields.ratePerKg) > 0) score += 15;
  if (parseNumber(fields.taxableValue) > 0) score += 15;
  if (parseNumber(fields.receivedKg) > 0) score += 10;

  return Math.min(score, 100);
}

function scoreTeaExtraction({ vendorName, vendorGstin, invoiceNumber, invoiceDate, items, netTotal, taxableValue }) {
  let score = 10;

  if (vendorName) score += 10;
  if (vendorGstin) score += 10;
  if (invoiceNumber) score += 8;
  if (invoiceDate) score += 8;
  if (netTotal) score += 8;
  if (taxableValue) score += 8;

  if (items.length) {
    const averageLineConfidence =
      items.reduce((total, item) => total + (item.confidence || 0), 0) / items.length;
    score += Math.min(items.length * 3, 12);
    score += Math.round(averageLineConfidence * 0.26);
  }

  return Math.min(score, 96);
}

function valueOrBlank(value) {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue !== 0
    ? String(Math.round(parsedValue * 100) / 100)
    : '';
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function formatNumber(value) {
  return String(roundMoney(value)).replace(/\.00$/, '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const TeaInvoiceExtractor = {
  patterns: {
    gstin: new RegExp(GSTIN_PATTERN.source, 'i'),
    phone: PHONE_PATTERN,
    hsn: HSN_PATTERN,
    teaGrades: new RegExp(GRADE_PATTERN.source, 'i'),
    bagSpec: new RegExp(BAG_SPEC_PATTERN.source, 'i'),
  },
  constants: {
    gstRate: GST_RATE,
    buyerGstin: BUYER_GSTIN,
    teaGrades: TEA_GRADES,
  },
  parseTeaInvoiceText,
  parseTeaLineItems,
  buildTeaLineItem,
  normalizeLines,
  getNumberTokens,
  determineGstType,
  inferStateFromGstin,
};

export default {
  parseTeaInvoiceText,
  parseTeaLineItems,
  buildTeaLineItem,
  createEmptyInvoiceLine,
  createEmptyInvoiceCharge,
  createEmptyInvoiceDraft,
  TeaInvoiceExtractor,
};
