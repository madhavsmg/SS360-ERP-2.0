import { prisma } from '../config/prisma.js';
import {
  validateOptionalGstin,
  validateOptionalIndianMobile,
} from '../utils/businessValidation.utils.js';
import { makeId } from '../utils/id.utils.js';
import { numberValue, roundMoney } from '../utils/number.utils.js';

const today = () => new Date().toISOString().slice(0, 10);

export async function approveInvoiceDraft(invoice, draft) {
  return prisma.$transaction(async (tx) => {
    const currentInvoice = await tx.invoice.findUnique({
      where: { id: invoice.id },
      include: { rawLots: true },
    });

    if (!currentInvoice) {
      const error = new Error('Invoice not found.');
      error.statusCode = 404;
      throw error;
    }

    if (currentInvoice.status === 'APPROVED') {
      return buildAlreadyApprovedResult(tx, currentInvoice);
    }

    const normalized = normalizeDraft(draft);
    validateApprovalDraft(normalized);

    const claim = await tx.invoice.updateMany({
      where: {
        id: currentInvoice.id,
        status: { not: 'APPROVED' },
      },
      data: { status: 'NEEDS_REVIEW' },
    });

    if (claim.count === 0) {
      const approvedInvoice = await tx.invoice.findUnique({
        where: { id: currentInvoice.id },
        include: { rawLots: true },
      });
      return buildAlreadyApprovedResult(tx, approvedInvoice);
    }

    const supplierName = normalized.vendor.name.trim();
    const invoiceNumber = normalized.invoice.number || currentInvoice.originalFileName;
    const invoiceDate = normalized.invoice.date || today();
    const invoiceIdForErp = makeId('INV', invoiceNumber);
    const lineRecords = buildLineRecords({
      draft: normalized,
      invoice: currentInvoice,
      invoiceDate,
      invoiceNumber,
    });
    const totals = buildTotals(normalized, lineRecords);

    const supplier = await tx.supplier.upsert({
      where: { name: supplierName },
      create: {
        name: supplierName,
        gstin: normalized.vendor.gstin || null,
        address: normalized.vendor.address || null,
        phone: normalized.vendor.phone || null,
        outstanding: totals.netTotal,
      },
      update: {
        gstin: normalized.vendor.gstin || undefined,
        address: normalized.vendor.address || undefined,
        phone: normalized.vendor.phone || undefined,
        outstanding: { increment: totals.netTotal },
      },
    });

    const rawLots = lineRecords.map((line) => ({
      id: line.rawLotId,
      invoiceId: currentInvoice.id,
      supplierId: supplier.id,
      supplierName: supplier.name,
      variety: line.variety,
      grade: line.grade,
      bags: line.bags,
      bagWeightKg: line.bagWeightKg,
      receivedKg: line.receivedKg,
      remainingKg: line.receivedKg,
      costPerKg: line.landedCostPerKg || line.ratePerKg,
      goodsRatePerKg: line.ratePerKg,
      goodsAmount: line.goodsAmount,
      acquisitionChargeShare: line.allocatedCharges,
      landedCost: line.landedCost,
      reorderKg: line.reorderKg,
      receivedDate: new Date(invoiceDate),
      qualityJson: { taste: 8, color: 8, aroma: 8 },
      movementsJson: [
        {
          id: makeId('MOV', line.variety),
          type: 'Invoice Received',
          kg: line.receivedKg,
          note: `Invoice ${invoiceNumber} approved`,
          date: invoiceDate,
        },
      ],
    }));

    await tx.rawInventoryLot.createMany({ data: rawLots });

    const approvedJson = {
      id: invoiceIdForErp,
      invoiceNumber,
      invoiceDate,
      supplierId: supplier.id,
      supplierName: supplier.name,
      vendorAddress: normalized.vendor.address,
      vendorGstin: normalized.vendor.gstin,
      sourceName: normalized.sourceName || currentInvoice.originalFileName,
      sourceType: normalized.sourceType || currentInvoice.sourceType || '',
      pageCount: numberValue(normalized.pageCount),
      extractionMode: normalized.extractionMode || '',
      confidence: numberValue(normalized.confidence),
      taxableValue: totals.taxableValue,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      totalTaxAmount: totals.cgstAmount + totals.sgstAmount + totals.igstAmount,
      miscChargesTotal: totals.miscChargesTotal,
      charges: normalized.charges,
      landedCostTotal: totals.landedCostTotal,
      grossTotal: totals.grossTotal,
      netTotal: totals.netTotal,
      approvedAt: today(),
      status: 'Approved',
      rawLotIds: rawLots.map((lot) => lot.id),
      lineItems: lineRecords.map((line) => line.lineItemJson),
      rawText: normalized.rawText || '',
    };

    const updatedInvoice = await tx.invoice.update({
      where: { id: currentInvoice.id },
      data: {
        status: 'APPROVED',
        reviewJson: normalized,
        approvedJson,
        approvedAt: new Date(),
      },
    });

    return {
      invoice: updatedInvoice,
      supplier,
      rawLots,
      approvedJson,
      alreadyApproved: false,
    };
  });
}

async function buildAlreadyApprovedResult(tx, invoice) {
  const supplierId = invoice?.approvedJson?.supplierId || invoice?.rawLots?.[0]?.supplierId;
  const supplier = supplierId ? await tx.supplier.findUnique({ where: { id: supplierId } }) : null;

  return {
    invoice,
    supplier,
    rawLots: invoice?.rawLots || [],
    approvedJson: invoice?.approvedJson || null,
    alreadyApproved: true,
  };
}

function normalizeDraft(draft) {
  const source = draft || {};
  const items = (source.items || [])
    .filter((item) => String(item.teaName || item.description || '').trim())
    .map((item) => ({
      ...item,
      teaName: String(item.teaName || item.description || 'Tea').trim(),
      grade: String(item.grade || '').trim(),
    }));

  return {
    ...source,
    vendor: source.vendor || {},
    invoice: source.invoice || {},
    totals: source.totals || {},
    charges: source.charges || [],
    items,
  };
}

function buildLineRecords({ draft, invoice, invoiceDate }) {
  const totalReceivedKg = draft.items.reduce(
    (total, item) => total + lineNumbers(item).receivedKg,
    0
  );
  const miscChargesTotal =
    numberValue(draft.totals.miscChargesTotal) ||
    draft.charges.reduce((total, charge) => total + numberValue(charge.amount), 0);

  return draft.items.map((item) => {
    const numbers = lineNumbers(item);
    const allocationRatio =
      totalReceivedKg > 0 ? numbers.receivedKg / totalReceivedKg : 1 / draft.items.length;
    const allocatedCharges = roundMoney(miscChargesTotal * allocationRatio);
    const landedCost = roundMoney(numbers.taxableValue + allocatedCharges);
    const landedCostPerKg =
      numbers.receivedKg > 0 ? roundMoney(landedCost / numbers.receivedKg) : 0;
    const grade = item.grade || item.hsn || 'Invoice';
    const rawLotId = makeId('RAW', `${item.teaName}-${grade}`);

    return {
      rawLotId,
      variety: item.teaName,
      grade,
      bags: numbers.quantity,
      bagWeightKg: numbers.unitWeightKg,
      receivedKg: numbers.receivedKg,
      ratePerKg: numbers.ratePerKg,
      goodsAmount: numbers.taxableValue,
      allocatedCharges,
      landedCost,
      landedCostPerKg,
      reorderKg: numbers.reorderKg,
      lineItemJson: {
        teaName: item.teaName,
        grade,
        hsn: item.hsn || '',
        quantity: numbers.quantity,
        unit: item.unit || 'Bags',
        unitWeightKg: numbers.unitWeightKg,
        receivedKg: numbers.receivedKg,
        ratePerKg: numbers.ratePerKg,
        taxableValue: numbers.taxableValue,
        allocatedCharges,
        landedCost,
        landedCostPerKg,
        cgstRate: numbers.cgstRate,
        cgstAmount: numbers.cgstAmount,
        sgstRate: numbers.sgstRate,
        sgstAmount: numbers.sgstAmount,
        igstRate: numbers.igstRate,
        igstAmount: numbers.igstAmount,
        lineTotal: numbers.lineTotal,
        rawLotId,
        invoiceId: invoice.id,
        invoiceDate,
      },
    };
  });
}

function validateApprovalDraft(draft) {
  const supplierName = draft.vendor.name.trim();

  if (!supplierName) {
    throwPublicError('Vendor name is required before approval.');
  }

  const vendorPhoneError = validateOptionalIndianMobile(draft.vendor.phone, 'Vendor mobile number');
  if (vendorPhoneError) {
    throwPublicError(vendorPhoneError);
  }

  const vendorGstinError = validateOptionalGstin(draft.vendor.gstin, 'Vendor GSTIN');
  if (vendorGstinError) {
    throwPublicError(vendorGstinError);
  }

  const invoiceDate = draft.invoice.date;
  if (invoiceDate && Number.isNaN(Date.parse(invoiceDate))) {
    throwPublicError('Invoice date must be a valid date.');
  }

  if (invoiceDate && invoiceDate > today()) {
    throwPublicError('Invoice date cannot be in the future.');
  }

  if (!draft.items.length) {
    throwPublicError('Add at least one invoice stock line before approval.');
  }

  draft.items.forEach((item, index) => {
    const numbers = lineNumbers(item);
    const lineLabel = `Stock line ${index + 1}`;

    if (!String(item.teaName || '').trim()) {
      throwPublicError(`${lineLabel} needs a tea name.`);
    }

    if (numbers.quantity <= 0 || numbers.receivedKg <= 0 || numbers.ratePerKg <= 0) {
      throwPublicError(`${lineLabel} needs positive quantity, received kg, and rate/kg.`);
    }
  });
}

function throwPublicError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function buildTotals(draft, lineRecords) {
  const taxableTotal = roundMoney(lineRecords.reduce((total, line) => total + line.goodsAmount, 0));
  const parsedChargesTotal = roundMoney(
    draft.charges.reduce((total, charge) => total + numberValue(charge.amount), 0)
  );
  const miscChargesTotal = roundMoney(
    numberValue(draft.totals.miscChargesTotal, parsedChargesTotal)
  );
  const cgstAmount = roundMoney(numberValue(draft.totals.cgstAmount));
  const sgstAmount = roundMoney(numberValue(draft.totals.sgstAmount));
  const igstAmount = roundMoney(numberValue(draft.totals.igstAmount));
  const grossTotal = roundMoney(
    numberValue(draft.totals.grossTotal, taxableTotal + miscChargesTotal)
  );
  const netTotal = roundMoney(
    numberValue(draft.totals.netTotal, grossTotal + cgstAmount + sgstAmount + igstAmount)
  );

  return {
    taxableValue: roundMoney(numberValue(draft.totals.taxableValue, taxableTotal)),
    cgstAmount,
    sgstAmount,
    igstAmount,
    miscChargesTotal,
    landedCostTotal: roundMoney(taxableTotal + miscChargesTotal),
    grossTotal,
    netTotal,
  };
}

function lineNumbers(item) {
  const quantity = numberValue(item.quantity || item.bagCount || item.bags);
  const unitWeightKg = numberValue(item.unitWeightKg || item.bagWeightKg, 1);
  const receivedKg = numberValue(item.receivedKg || item.totalNett || quantity * unitWeightKg);
  const taxableValue = numberValue(
    item.taxableValue || item.amount || receivedKg * numberValue(item.ratePerKg || item.rate)
  );
  const ratePerKg = numberValue(
    item.ratePerKg || item.rate,
    receivedKg > 0 ? taxableValue / receivedKg : 0
  );
  const cgstAmount = numberValue(item.cgstAmount);
  const sgstAmount = numberValue(item.sgstAmount);
  const igstAmount = numberValue(item.igstAmount);

  return {
    quantity,
    unitWeightKg,
    receivedKg,
    taxableValue: roundMoney(taxableValue),
    ratePerKg: roundMoney(ratePerKg),
    cgstRate: numberValue(item.cgstRate),
    cgstAmount: roundMoney(cgstAmount),
    sgstRate: numberValue(item.sgstRate),
    sgstAmount: roundMoney(sgstAmount),
    igstRate: numberValue(item.igstRate),
    igstAmount: roundMoney(igstAmount),
    lineTotal: roundMoney(
      numberValue(item.lineTotal, taxableValue + cgstAmount + sgstAmount + igstAmount)
    ),
    reorderKg: numberValue(item.reorderKg, Math.max(receivedKg * 0.2, 25)),
  };
}
