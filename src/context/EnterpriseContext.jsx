import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'ss360.enterpriseData.v1';

const today = new Date().toISOString().slice(0, 10);

const seedData = {
  suppliers: [
    {
      id: 'SUP-MOKALBARI',
      name: 'Mokalbari Estate',
      agentName: 'Ramesh Agent',
      phone: '+91 90000 10421',
      region: 'Assam',
      paymentTerms: '15 days',
      reliabilityScore: 94,
      qualityScore: 91,
      outstanding: 45260,
    },
    {
      id: 'SUP-EASTERN',
      name: 'Eastern Estates',
      agentName: 'Prakash Tea Brokers',
      phone: '+91 90000 10446',
      region: 'Dooars',
      paymentTerms: 'Cash/7 days',
      reliabilityScore: 88,
      qualityScore: 84,
      outstanding: 15840,
    },
    {
      id: 'SUP-BLUEMOUNTAIN',
      name: 'Blue Mountain Traders',
      agentName: 'Suresh Kumar',
      phone: '+91 90000 10390',
      region: 'Nilgiri',
      paymentTerms: '20 days',
      reliabilityScore: 90,
      qualityScore: 93,
      outstanding: 0,
    },
  ],
  customers: [
    {
      id: 'CUS-LAKSHMI',
      name: 'Sri Lakshmi Hotel Supplies',
      type: 'Wholesale',
      phone: '+91 98855 00112',
      city: 'Rajahmundry',
      deliveryPreference: 'Auto transport',
      creditLimit: 75000,
      outstanding: 11760,
    },
    {
      id: 'CUS-SRINIVASA',
      name: 'Srinivasa Retail Stores',
      type: 'Retailer',
      phone: '+91 98855 00133',
      city: 'Kakinada',
      deliveryPreference: 'Parcel service',
      creditLimit: 50000,
      outstanding: 0,
    },
  ],
  purchaseOrders: [
    {
      id: 'PO-ASSAM-BOP-20250419',
      supplierId: 'SUP-MOKALBARI',
      supplierName: 'Mokalbari Estate',
      variety: 'Assam CTC',
      grade: 'BOP',
      orderBags: 12,
      bagWeightKg: 35,
      ratePerKg: 146,
      orderedKg: 420,
      receivedKg: 420,
      expectedDate: '2025-04-19',
      status: 'Received',
      sample: {
        taste: 9,
        color: 8,
        aroma: 8,
        approved: true,
      },
      totalCost: 61320,
      paidAmount: 16060,
    },
    {
      id: 'PO-DUST-STD-20250419',
      supplierId: 'SUP-EASTERN',
      supplierName: 'Eastern Estates',
      variety: 'Tea Dust',
      grade: 'Standard',
      orderBags: 6,
      bagWeightKg: 30,
      ratePerKg: 88,
      orderedKg: 180,
      receivedKg: 180,
      expectedDate: '2025-04-19',
      status: 'Received',
      sample: {
        taste: 7,
        color: 9,
        aroma: 7,
        approved: true,
      },
      totalCost: 15840,
      paidAmount: 0,
    },
  ],
  rawLots: [
    {
      id: 'RAW-ASSAM-BOP-20250419-01',
      purchaseOrderId: 'PO-ASSAM-BOP-20250419',
      supplierId: 'SUP-MOKALBARI',
      supplierName: 'Mokalbari Estate',
      variety: 'Assam CTC',
      grade: 'BOP',
      bags: 12,
      bagWeightKg: 35,
      receivedKg: 420,
      remainingKg: 310,
      costPerKg: 146,
      reorderKg: 80,
      receivedDate: '2025-04-19',
      quality: {
        taste: 9,
        color: 8,
        aroma: 8,
      },
      movements: [
        {
          id: 'MOV-RAW-01',
          type: 'Received',
          kg: 420,
          note: 'PO-ASSAM-BOP-20250419 received',
          date: '2025-04-19',
        },
        {
          id: 'MOV-RAW-02',
          type: 'Blend Issue',
          kg: -110,
          note: 'Used in Hotel Strong Blend',
          date: '2025-04-20',
        },
      ],
    },
    {
      id: 'RAW-DUST-STD-20250419-02',
      purchaseOrderId: 'PO-DUST-STD-20250419',
      supplierId: 'SUP-EASTERN',
      supplierName: 'Eastern Estates',
      variety: 'Tea Dust',
      grade: 'Standard',
      bags: 6,
      bagWeightKg: 30,
      receivedKg: 180,
      remainingKg: 130,
      costPerKg: 88,
      reorderKg: 60,
      receivedDate: '2025-04-19',
      quality: {
        taste: 7,
        color: 9,
        aroma: 7,
      },
      movements: [
        {
          id: 'MOV-RAW-03',
          type: 'Received',
          kg: 180,
          note: 'PO-DUST-STD-20250419 received',
          date: '2025-04-19',
        },
        {
          id: 'MOV-RAW-04',
          type: 'Blend Issue',
          kg: -50,
          note: 'Used in Hotel Strong Blend',
          date: '2025-04-20',
        },
      ],
    },
    {
      id: 'RAW-NILGIRI-FOP-20250418-03',
      purchaseOrderId: 'MANUAL-OPENING',
      supplierId: 'SUP-BLUEMOUNTAIN',
      supplierName: 'Blue Mountain Traders',
      variety: 'Nilgiri Leaf',
      grade: 'FOP',
      bags: 8,
      bagWeightKg: 30,
      receivedKg: 240,
      remainingKg: 220,
      costPerKg: 172,
      reorderKg: 70,
      receivedDate: '2025-04-18',
      quality: {
        taste: 8,
        color: 7,
        aroma: 9,
      },
      movements: [
        {
          id: 'MOV-RAW-05',
          type: 'Received',
          kg: 240,
          note: 'Opening stock',
          date: '2025-04-18',
        },
        {
          id: 'MOV-RAW-06',
          type: 'Blend Issue',
          kg: -20,
          note: 'Used in Hotel Strong Blend',
          date: '2025-04-20',
        },
      ],
    },
  ],
  blendBatches: [
    {
      id: 'BLD-HOTEL-STRONG-20250420-01',
      productName: 'Hotel Strong Blend',
      sku: 'HOTEL-STRONG',
      createdDate: '2025-04-20',
      batchKg: 180,
      remainingKg: 132,
      sellingPricePerKg: 245,
      packingCostPerKg: 12,
      laborCost: 900,
      overheadCost: 450,
      rawMaterialCost: 23900,
      packingCost: 2160,
      totalCost: 27410,
      costPerKg: 152.28,
      expectedRevenue: 44100,
      expectedProfit: 16690,
      packagingStatus: 'Packed',
      components: [
        {
          lotId: 'RAW-ASSAM-BOP-20250419-01',
          variety: 'Assam CTC',
          grade: 'BOP',
          kgUsed: 110,
          costPerKg: 146,
          cost: 16060,
        },
        {
          lotId: 'RAW-DUST-STD-20250419-02',
          variety: 'Tea Dust',
          grade: 'Standard',
          kgUsed: 50,
          costPerKg: 88,
          cost: 4400,
        },
        {
          lotId: 'RAW-NILGIRI-FOP-20250418-03',
          variety: 'Nilgiri Leaf',
          grade: 'FOP',
          kgUsed: 20,
          costPerKg: 172,
          cost: 3440,
        },
      ],
    },
  ],
  salesOrders: [
    {
      id: 'SO-20250421-01',
      customerId: 'CUS-LAKSHMI',
      customerName: 'Sri Lakshmi Hotel Supplies',
      itemType: 'blend',
      itemId: 'BLD-HOTEL-STRONG-20250420-01',
      itemName: 'Hotel Strong Blend',
      kg: 48,
      pricePerKg: 245,
      shippingCharge: 0,
      revenue: 11760,
      cogs: 7309.44,
      profit: 4450.56,
      orderDate: '2025-04-21',
      status: 'Delivered',
      saleType: 'Wholesale',
    },
  ],
  shipments: [
    {
      id: 'SHIP-20250421-01',
      orderId: 'SO-20250421-01',
      customerName: 'Sri Lakshmi Hotel Supplies',
      destination: 'Rajahmundry',
      transportMode: 'Auto transport',
      vehicleNo: 'AP05-T-4411',
      status: 'Delivered',
      packedDate: '2025-04-21',
      shippedDate: '2025-04-21',
      deliveredDate: '2025-04-21',
      note: 'Delivered to hotel stores counter',
    },
  ],
  invoiceReceipts: [],
};

const EnterpriseContext = createContext(null);

function numberValue(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function presentNumber(value, fallback = 0) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback;
  }

  return numberValue(value, fallback);
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function slugify(value, fallback = 'ITEM') {
  const slug = String(value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 18);

  return slug || fallback;
}

function makeId(prefix, value) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${slugify(value)}-${datePart}-${randomPart}`;
}

function normalizeData(data) {
  return {
    suppliers: data.suppliers || [],
    customers: data.customers || [],
    purchaseOrders: data.purchaseOrders || [],
    rawLots: data.rawLots || [],
    blendBatches: data.blendBatches || [],
    salesOrders: data.salesOrders || [],
    shipments: data.shipments || [],
    invoiceReceipts: data.invoiceReceipts || [],
  };
}

function loadData() {
  try {
    const storedData = window.localStorage.getItem(STORAGE_KEY);
    return storedData ? normalizeData(JSON.parse(storedData)) : normalizeData(seedData);
  } catch {
    return normalizeData(seedData);
  }
}

function createBlendPreview(form, rawLots) {
  const components = (form.components || [])
    .map((component) => {
      const lot = rawLots.find((rawLot) => rawLot.id === component.lotId);
      const kgUsed = numberValue(component.kg);

      if (!lot || kgUsed <= 0) {
        return null;
      }

      return {
        lot,
        kgUsed,
        cost: roundMoney(kgUsed * lot.costPerKg),
      };
    })
    .filter(Boolean);
  const batchKg = components.reduce((total, component) => total + component.kgUsed, 0);
  const rawMaterialCost = components.reduce((total, component) => total + component.cost, 0);
  const packingCost = batchKg * numberValue(form.packingCostPerKg);
  const laborCost = numberValue(form.laborCost);
  const overheadCost = numberValue(form.overheadCost);
  const totalCost = rawMaterialCost + packingCost + laborCost + overheadCost;
  const sellingPricePerKg = numberValue(form.sellingPricePerKg);
  const expectedRevenue = batchKg * sellingPricePerKg;
  const expectedProfit = expectedRevenue - totalCost;

  return {
    components,
    batchKg: roundMoney(batchKg),
    rawMaterialCost: roundMoney(rawMaterialCost),
    packingCost: roundMoney(packingCost),
    laborCost: roundMoney(laborCost),
    overheadCost: roundMoney(overheadCost),
    totalCost: roundMoney(totalCost),
    costPerKg: batchKg > 0 ? roundMoney(totalCost / batchKg) : 0,
    sellingPricePerKg,
    expectedRevenue: roundMoney(expectedRevenue),
    expectedProfit: roundMoney(expectedProfit),
    marginPercent: expectedRevenue > 0 ? roundMoney((expectedProfit / expectedRevenue) * 100) : 0,
  };
}

function getInventoryItem(data, itemType, itemId) {
  if (itemType === 'raw') {
    return data.rawLots.find((lot) => lot.id === itemId);
  }

  return data.blendBatches.find((batch) => batch.id === itemId);
}

function getItemCostPerKg(itemType, item) {
  if (!item) {
    return 0;
  }

  return itemType === 'raw' ? item.costPerKg : item.costPerKg;
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function regionFromAddress(address) {
  const addressParts = String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return addressParts.slice(-2, -1)[0] || addressParts.at(-1) || 'Invoice Vendor';
}

function getInvoiceLineNumbers(item) {
  const quantity = presentNumber(item.quantity);
  const unitWeightKg = presentNumber(item.unitWeightKg, 1);
  const receivedKg = presentNumber(item.receivedKg, quantity * unitWeightKg);
  const taxableValue = presentNumber(item.taxableValue);
  const ratePerKg = presentNumber(item.ratePerKg, receivedKg > 0 ? taxableValue / receivedKg : 0);
  const cgstAmount = presentNumber(item.cgstAmount);
  const sgstAmount = presentNumber(item.sgstAmount);
  const igstAmount = presentNumber(item.igstAmount);
  const lineTotal = presentNumber(
    item.lineTotal,
    taxableValue + cgstAmount + sgstAmount + igstAmount
  );

  return {
    quantity,
    unitWeightKg,
    receivedKg,
    taxableValue: roundMoney(taxableValue || receivedKg * ratePerKg),
    ratePerKg: roundMoney(ratePerKg),
    cgstRate: presentNumber(item.cgstRate),
    cgstAmount: roundMoney(cgstAmount),
    sgstRate: presentNumber(item.sgstRate),
    sgstAmount: roundMoney(sgstAmount),
    igstRate: presentNumber(item.igstRate),
    igstAmount: roundMoney(igstAmount),
    lineTotal: roundMoney(lineTotal),
    reorderKg: presentNumber(item.reorderKg, Math.max(receivedKg * 0.2, 25)),
  };
}

function getInvoiceCharges(draft) {
  return (draft.charges || [])
    .map((charge) => ({
      id: charge.id || makeId('CHG', charge.label || charge.category || 'charge'),
      label: charge.label?.trim() || charge.category?.trim() || 'Miscellaneous charge',
      category: charge.category?.trim() || 'Miscellaneous',
      amount: roundMoney(presentNumber(charge.amount)),
      allocationMethod: charge.allocationMethod || 'By kg',
      includeInLandedCost: charge.includeInLandedCost !== false,
    }))
    .filter((charge) => charge.amount > 0);
}

export function EnterpriseProvider({ children }) {
  const [data, setData] = useState(loadData);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const metrics = useMemo(() => {
    const rawKg = data.rawLots.reduce((total, lot) => total + numberValue(lot.remainingKg), 0);
    const rawValue = data.rawLots.reduce(
      (total, lot) => total + numberValue(lot.remainingKg) * numberValue(lot.costPerKg),
      0
    );
    const finishedKg = data.blendBatches.reduce(
      (total, batch) => total + numberValue(batch.remainingKg),
      0
    );
    const finishedValue = data.blendBatches.reduce(
      (total, batch) => total + numberValue(batch.remainingKg) * numberValue(batch.costPerKg),
      0
    );
    const salesRevenue = data.salesOrders.reduce(
      (total, order) => total + numberValue(order.revenue),
      0
    );
    const salesProfit = data.salesOrders.reduce(
      (total, order) => total + numberValue(order.profit),
      0
    );
    const supplierOutstanding = data.suppliers.reduce(
      (total, supplier) => total + numberValue(supplier.outstanding),
      0
    );
    const customerOutstanding = data.customers.reduce(
      (total, customer) => total + numberValue(customer.outstanding),
      0
    );

    return {
      rawKg: roundMoney(rawKg),
      rawValue: roundMoney(rawValue),
      finishedKg: roundMoney(finishedKg),
      finishedValue: roundMoney(finishedValue),
      salesRevenue: roundMoney(salesRevenue),
      salesProfit: roundMoney(salesProfit),
      supplierOutstanding: roundMoney(supplierOutstanding),
      customerOutstanding: roundMoney(customerOutstanding),
      lowRawLots: data.rawLots.filter((lot) => lot.remainingKg <= lot.reorderKg).length,
      pendingPurchaseOrders: data.purchaseOrders.filter((order) => order.status !== 'Received')
        .length,
      openShipments: data.shipments.filter((shipment) => shipment.status !== 'Delivered').length,
    };
  }, [data]);

  function addSupplier(form) {
    const supplier = {
      id: makeId('SUP', form.name),
      name: form.name.trim(),
      agentName: form.agentName.trim(),
      phone: form.phone.trim(),
      region: form.region.trim(),
      paymentTerms: form.paymentTerms.trim() || '7 days',
      reliabilityScore: numberValue(form.reliabilityScore, 80),
      qualityScore: numberValue(form.qualityScore, 80),
      outstanding: 0,
    };

    setData((currentData) => ({
      ...currentData,
      suppliers: [supplier, ...currentData.suppliers],
    }));

    return supplier;
  }

  function createPurchaseOrder(form) {
    const supplier = data.suppliers.find((item) => item.id === form.supplierId);
    const orderBags = numberValue(form.orderBags);
    const bagWeightKg = numberValue(form.bagWeightKg);
    const ratePerKg = numberValue(form.ratePerKg);
    const orderedKg = roundMoney(orderBags * bagWeightKg);
    const sample = {
      taste: numberValue(form.taste),
      color: numberValue(form.color),
      aroma: numberValue(form.aroma),
      approved: form.sampleApproved === true || form.sampleApproved === 'true',
    };

    if (!supplier || !form.variety.trim() || !form.grade.trim()) {
      throw new Error('Select supplier, variety, and grade before creating a PO.');
    }

    if (orderBags <= 0 || bagWeightKg <= 0 || ratePerKg <= 0) {
      throw new Error('Bags, bag weight, and rate must be greater than zero.');
    }

    if (!sample.approved) {
      throw new Error('Sample must be approved before placing a purchase order.');
    }

    const purchaseOrder = {
      id: makeId('PO', `${form.variety}-${form.grade}`),
      supplierId: supplier.id,
      supplierName: supplier.name,
      variety: form.variety.trim(),
      grade: form.grade.trim(),
      orderBags,
      bagWeightKg,
      ratePerKg,
      orderedKg,
      receivedKg: 0,
      expectedDate: form.expectedDate || today,
      status: 'Ordered',
      sample,
      totalCost: roundMoney(orderedKg * ratePerKg),
      paidAmount: 0,
    };

    setData((currentData) => ({
      ...currentData,
      purchaseOrders: [purchaseOrder, ...currentData.purchaseOrders],
    }));

    return purchaseOrder;
  }

  function receivePurchaseOrder(form) {
    const order = data.purchaseOrders.find((item) => item.id === form.purchaseOrderId);
    const receivedBags = numberValue(form.receivedBags || order?.orderBags);

    if (!order) {
      throw new Error('Select a purchase order to receive.');
    }

    if (order.status === 'Received') {
      throw new Error('This purchase order has already been received.');
    }

    if (receivedBags <= 0) {
      throw new Error('Received bags must be greater than zero.');
    }

    const receivedKg = roundMoney(receivedBags * order.bagWeightKg);
    const receivedCost = roundMoney(receivedKg * order.ratePerKg);
    const rawLot = {
      id: makeId('RAW', `${order.variety}-${order.grade}`),
      purchaseOrderId: order.id,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      variety: order.variety,
      grade: order.grade,
      bags: receivedBags,
      bagWeightKg: order.bagWeightKg,
      receivedKg,
      remainingKg: receivedKg,
      costPerKg: order.ratePerKg,
      reorderKg: numberValue(form.reorderKg, Math.max(order.bagWeightKg, 50)),
      receivedDate: form.receivedDate || today,
      quality: {
        taste: order.sample.taste,
        color: order.sample.color,
        aroma: order.sample.aroma,
      },
      movements: [
        {
          id: makeId('MOV', order.variety),
          type: 'Received',
          kg: receivedKg,
          note: `${order.id} received`,
          date: form.receivedDate || today,
        },
      ],
    };

    setData((currentData) => ({
      ...currentData,
      rawLots: [rawLot, ...currentData.rawLots],
      purchaseOrders: currentData.purchaseOrders.map((purchaseOrder) =>
        purchaseOrder.id === order.id
          ? {
              ...purchaseOrder,
              status: 'Received',
              receivedKg,
              totalCost: receivedCost,
            }
          : purchaseOrder
      ),
      suppliers: currentData.suppliers.map((supplier) =>
        supplier.id === order.supplierId
          ? {
              ...supplier,
              outstanding: roundMoney(numberValue(supplier.outstanding) + receivedCost),
            }
          : supplier
      ),
    }));

    return rawLot;
  }

  function approveInvoiceReceipt(draft) {
    const vendorName = draft.vendor?.name?.trim();
    const invoiceNumber = draft.invoice?.number?.trim() || 'Unnumbered';
    const invoiceDate = draft.invoice?.date || today;
    const draftItems = (draft.items || []).filter((item) => item.teaName?.trim());

    if (!vendorName) {
      throw new Error('Vendor name is required before approving the invoice.');
    }

    if (!draftItems.length) {
      throw new Error('Add at least one invoice stock line before approval.');
    }

    const invalidItem = draftItems.find((item) => {
      const numbers = getInvoiceLineNumbers(item);
      return (
        !item.teaName.trim() ||
        numbers.quantity <= 0 ||
        numbers.receivedKg <= 0 ||
        numbers.ratePerKg <= 0
      );
    });

    if (invalidItem) {
      throw new Error('Every stock line needs name, quantity, received kg, and rate/kg.');
    }

    const existingSupplier = data.suppliers.find(
      (supplier) => normalizeKey(supplier.name) === normalizeKey(vendorName)
    );
    const generatedSupplier = {
      id: makeId('SUP', vendorName),
      name: vendorName,
      agentName: 'Invoice Intake',
      phone: draft.vendor?.phone?.trim() || '',
      region: regionFromAddress(draft.vendor?.address),
      paymentTerms: 'Invoice due',
      reliabilityScore: 80,
      qualityScore: 80,
      outstanding: 0,
      gstin: draft.vendor?.gstin?.trim() || '',
      address: draft.vendor?.address?.trim() || '',
    };
    const invoiceId = makeId('INV', invoiceNumber);
    let approvalResult = null;

    setData((currentData) => {
      const currentSupplier =
        currentData.suppliers.find(
          (supplier) => normalizeKey(supplier.name) === normalizeKey(vendorName)
        ) ||
        existingSupplier ||
        generatedSupplier;
      const lineItems = draftItems.map((item, index) => {
        const numbers = getInvoiceLineNumbers(item);
        const grade = item.grade?.trim() || item.hsn?.trim() || 'Invoice';
        const bagWeightKg = numbers.quantity > 0 ? numbers.receivedKg / numbers.quantity : 1;
        const purchaseOrderId = makeId('PO', `${item.teaName}-${invoiceNumber}-${index + 1}`);
        const rawLotId = makeId('RAW', `${item.teaName}-${grade}`);

        return {
          draft: item,
          numbers,
          grade,
          bagWeightKg: roundMoney(bagWeightKg),
          purchaseOrderId,
          rawLotId,
        };
      });
      const taxableTotal = lineItems.reduce((total, line) => total + line.numbers.taxableValue, 0);
      const invoiceCharges = getInvoiceCharges(draft);
      const parsedChargesTotal = invoiceCharges.reduce((total, charge) => total + charge.amount, 0);
      const miscChargesTotal = presentNumber(draft.totals?.miscChargesTotal, parsedChargesTotal);
      const normalizedCharges =
        invoiceCharges.length || miscChargesTotal <= 0
          ? invoiceCharges
          : [
              {
                id: makeId('CHG', invoiceNumber),
                label: 'Miscellaneous invoice charges',
                category: 'Miscellaneous',
                amount: roundMoney(miscChargesTotal),
                allocationMethod: 'By kg',
                includeInLandedCost: true,
              },
            ];
      const landedChargeTotal =
        miscChargesTotal ||
        normalizedCharges
          .filter((charge) => charge.includeInLandedCost)
          .reduce((total, charge) => total + charge.amount, 0);
      const totalReceivedKg = lineItems.reduce(
        (total, line) => total + line.numbers.receivedKg,
        0
      );
      const lineItemsWithCosts = lineItems.map((line) => {
        const allocationRatio =
          totalReceivedKg > 0 ? line.numbers.receivedKg / totalReceivedKg : 1 / lineItems.length;
        const allocatedCharges = roundMoney(landedChargeTotal * allocationRatio);
        const landedCost = roundMoney(line.numbers.taxableValue + allocatedCharges);

        return {
          ...line,
          allocatedCharges,
          landedCost,
          landedCostPerKg:
            line.numbers.receivedKg > 0 ? roundMoney(landedCost / line.numbers.receivedKg) : 0,
        };
      });
      const purchaseOrders = lineItemsWithCosts.map((line) => ({
        id: line.purchaseOrderId,
        supplierId: currentSupplier.id,
        supplierName: currentSupplier.name,
        variety: line.draft.teaName.trim(),
        grade: line.grade,
        orderBags: line.numbers.quantity,
        bagWeightKg: line.bagWeightKg,
        ratePerKg: line.numbers.ratePerKg,
        orderedKg: line.numbers.receivedKg,
        receivedKg: line.numbers.receivedKg,
        expectedDate: invoiceDate,
        status: 'Received',
        sample: {
          taste: 8,
          color: 8,
          aroma: 8,
          approved: true,
        },
        totalCost: line.landedCost,
        goodsAmount: line.numbers.taxableValue,
        allocatedCharges: line.allocatedCharges,
        landedCostPerKg: line.landedCostPerKg,
        paidAmount: 0,
        invoiceId,
        invoiceNumber,
      }));
      const rawLots = lineItemsWithCosts.map((line) => ({
        id: line.rawLotId,
        purchaseOrderId: line.purchaseOrderId,
        supplierId: currentSupplier.id,
        supplierName: currentSupplier.name,
        variety: line.draft.teaName.trim(),
        grade: line.grade,
        bags: line.numbers.quantity,
        bagWeightKg: line.bagWeightKg,
        receivedKg: line.numbers.receivedKg,
        remainingKg: line.numbers.receivedKg,
        costPerKg: line.landedCostPerKg || line.numbers.ratePerKg,
        goodsRatePerKg: line.numbers.ratePerKg,
        goodsAmount: line.numbers.taxableValue,
        acquisitionChargeShare: line.allocatedCharges,
        landedCost: line.landedCost,
        reorderKg: line.numbers.reorderKg,
        receivedDate: invoiceDate,
        quality: {
          taste: 8,
          color: 8,
          aroma: 8,
        },
        movements: [
          {
            id: makeId('MOV', line.draft.teaName),
            type: 'Invoice Received',
            kg: line.numbers.receivedKg,
            note: `Invoice ${invoiceNumber} approved`,
            date: invoiceDate,
          },
        ],
      }));
      const cgstAmount = presentNumber(
        draft.totals?.cgstAmount,
        lineItemsWithCosts.reduce((total, line) => total + line.numbers.cgstAmount, 0)
      );
      const sgstAmount = presentNumber(
        draft.totals?.sgstAmount,
        lineItemsWithCosts.reduce((total, line) => total + line.numbers.sgstAmount, 0)
      );
      const igstAmount = presentNumber(draft.totals?.igstAmount);
      const grossTotal = presentNumber(draft.totals?.grossTotal, taxableTotal + miscChargesTotal);
      const netTotal = presentNumber(
        draft.totals?.netTotal,
        grossTotal + cgstAmount + sgstAmount + igstAmount
      );
      const invoiceRecord = {
        id: invoiceId,
        invoiceNumber,
        invoiceDate,
        supplierId: currentSupplier.id,
        supplierName: currentSupplier.name,
        vendorAddress: draft.vendor?.address?.trim() || '',
        vendorGstin: draft.vendor?.gstin?.trim() || '',
        sourceName: draft.sourceName || '',
        sourceType: draft.sourceType || '',
        pageCount: presentNumber(draft.pageCount),
        extractionMode: draft.extractionMode || '',
        confidence: presentNumber(draft.confidence),
        taxableValue: roundMoney(presentNumber(draft.totals?.taxableValue, taxableTotal)),
        cgstAmount: roundMoney(cgstAmount),
        sgstAmount: roundMoney(sgstAmount),
        igstAmount: roundMoney(igstAmount),
        totalTaxAmount: roundMoney(cgstAmount + sgstAmount + igstAmount),
        miscChargesTotal: roundMoney(miscChargesTotal),
        charges: normalizedCharges,
        landedCostTotal: roundMoney(taxableTotal + landedChargeTotal),
        grossTotal: roundMoney(grossTotal),
        netTotal: roundMoney(netTotal),
        approvedAt: today,
        status: 'Approved',
        purchaseOrderIds: purchaseOrders.map((order) => order.id),
        rawLotIds: rawLots.map((lot) => lot.id),
        lineItems: lineItemsWithCosts.map((line) => ({
          teaName: line.draft.teaName.trim(),
          grade: line.grade,
          hsn: line.draft.hsn?.trim() || '',
          quantity: line.numbers.quantity,
          unit: line.draft.unit || 'Bags',
          unitWeightKg: line.numbers.unitWeightKg,
          receivedKg: line.numbers.receivedKg,
          ratePerKg: line.numbers.ratePerKg,
          taxableValue: line.numbers.taxableValue,
          allocatedCharges: line.allocatedCharges,
          landedCost: line.landedCost,
          landedCostPerKg: line.landedCostPerKg,
          cgstRate: line.numbers.cgstRate,
          cgstAmount: line.numbers.cgstAmount,
          sgstRate: line.numbers.sgstRate,
          sgstAmount: line.numbers.sgstAmount,
          igstRate: line.numbers.igstRate,
          igstAmount: line.numbers.igstAmount,
          lineTotal: line.numbers.lineTotal,
          rawLotId: line.rawLotId,
          purchaseOrderId: line.purchaseOrderId,
        })),
        rawText: draft.rawText || '',
      };
      const supplierAlreadyPresent = currentData.suppliers.some(
        (supplier) => supplier.id === currentSupplier.id
      );
      const suppliers = supplierAlreadyPresent
        ? currentData.suppliers.map((supplier) =>
            supplier.id === currentSupplier.id
              ? {
                  ...supplier,
                  gstin: supplier.gstin || currentSupplier.gstin,
                  address: supplier.address || currentSupplier.address,
                  outstanding: roundMoney(
                    numberValue(supplier.outstanding) + invoiceRecord.netTotal
                  ),
                }
              : supplier
          )
        : [
            {
              ...currentSupplier,
              outstanding: roundMoney(invoiceRecord.netTotal),
            },
            ...currentData.suppliers,
          ];

      approvalResult = {
        invoice: invoiceRecord,
        rawLots,
        purchaseOrders,
      };

      return {
        ...currentData,
        suppliers,
        purchaseOrders: [...purchaseOrders, ...currentData.purchaseOrders],
        rawLots: [...rawLots, ...currentData.rawLots],
        invoiceReceipts: [invoiceRecord, ...currentData.invoiceReceipts],
      };
    });

    return approvalResult;
  }

  function recordSupplierPayment(supplierId, amount) {
    const payment = numberValue(amount);

    if (payment <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    setData((currentData) => ({
      ...currentData,
      suppliers: currentData.suppliers.map((supplier) =>
        supplier.id === supplierId
          ? {
              ...supplier,
              outstanding: Math.max(roundMoney(numberValue(supplier.outstanding) - payment), 0),
            }
          : supplier
      ),
    }));
  }

  function addCustomer(form) {
    const customer = {
      id: makeId('CUS', form.name),
      name: form.name.trim(),
      type: form.type || 'Wholesale',
      phone: form.phone.trim(),
      city: form.city.trim(),
      deliveryPreference: form.deliveryPreference.trim() || 'Auto transport',
      creditLimit: numberValue(form.creditLimit, 50000),
      outstanding: 0,
    };

    setData((currentData) => ({
      ...currentData,
      customers: [customer, ...currentData.customers],
    }));

    return customer;
  }

  function recordCustomerPayment(customerId, amount) {
    const payment = numberValue(amount);

    if (payment <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    setData((currentData) => ({
      ...currentData,
      customers: currentData.customers.map((customer) =>
        customer.id === customerId
          ? {
              ...customer,
              outstanding: Math.max(roundMoney(numberValue(customer.outstanding) - payment), 0),
            }
          : customer
      ),
    }));
  }

  function createBlendBatch(form) {
    const preview = createBlendPreview(form, data.rawLots);

    if (!form.productName.trim()) {
      throw new Error('Enter a finished product name.');
    }

    if (preview.batchKg <= 0) {
      throw new Error('Select at least one raw tea lot and kg quantity.');
    }

    const overdrawn = preview.components.find(
      (component) => component.kgUsed > component.lot.remainingKg
    );

    if (overdrawn) {
      throw new Error(`${overdrawn.lot.variety} does not have enough stock.`);
    }

    if (preview.sellingPricePerKg <= 0) {
      throw new Error('Selling price is required for profit prediction.');
    }

    const blendBatch = {
      id: makeId('BLD', form.productName),
      productName: form.productName.trim(),
      sku: (form.sku.trim() || slugify(form.productName, 'BLEND')).toUpperCase(),
      createdDate: today,
      batchKg: preview.batchKg,
      remainingKg: preview.batchKg,
      sellingPricePerKg: preview.sellingPricePerKg,
      packingCostPerKg: numberValue(form.packingCostPerKg),
      laborCost: preview.laborCost,
      overheadCost: preview.overheadCost,
      rawMaterialCost: preview.rawMaterialCost,
      packingCost: preview.packingCost,
      totalCost: preview.totalCost,
      costPerKg: preview.costPerKg,
      expectedRevenue: preview.expectedRevenue,
      expectedProfit: preview.expectedProfit,
      packagingStatus: form.packagingStatus || 'Packed',
      components: preview.components.map((component) => ({
        lotId: component.lot.id,
        variety: component.lot.variety,
        grade: component.lot.grade,
        kgUsed: component.kgUsed,
        costPerKg: component.lot.costPerKg,
        cost: component.cost,
      })),
    };

    setData((currentData) => ({
      ...currentData,
      rawLots: currentData.rawLots.map((lot) => {
        const component = blendBatch.components.find((item) => item.lotId === lot.id);

        if (!component) {
          return lot;
        }

        return {
          ...lot,
          remainingKg: roundMoney(lot.remainingKg - component.kgUsed),
          movements: [
            {
              id: makeId('MOV', lot.variety),
              type: 'Blend Issue',
              kg: -component.kgUsed,
              note: `Used in ${blendBatch.productName}`,
              date: blendBatch.createdDate,
            },
            ...lot.movements,
          ],
        };
      }),
      blendBatches: [blendBatch, ...currentData.blendBatches],
    }));

    return blendBatch;
  }

  function createSalesOrder(form) {
    const customer = data.customers.find((item) => item.id === form.customerId);
    const kg = numberValue(form.kg);
    const pricePerKg = numberValue(form.pricePerKg);
    const shippingCharge = numberValue(form.shippingCharge);
    const item = getInventoryItem(data, form.itemType, form.itemId);

    if (!customer || !item) {
      throw new Error('Select customer and item before creating sale.');
    }

    if (kg <= 0 || pricePerKg <= 0) {
      throw new Error('Sale kg and price must be greater than zero.');
    }

    if (kg > item.remainingKg) {
      throw new Error('Sale quantity cannot exceed available stock.');
    }

    const itemName = form.itemType === 'raw' ? `${item.variety} ${item.grade}` : item.productName;
    const revenue = roundMoney(kg * pricePerKg + shippingCharge);
    const cogs = roundMoney(kg * getItemCostPerKg(form.itemType, item));
    const order = {
      id: makeId('SO', itemName),
      customerId: customer.id,
      customerName: customer.name,
      itemType: form.itemType,
      itemId: item.id,
      itemName,
      kg,
      pricePerKg,
      shippingCharge,
      revenue,
      cogs,
      profit: roundMoney(revenue - cogs),
      orderDate: form.orderDate || today,
      status: 'Packed',
      saleType: form.saleType || customer.type,
    };
    const shipment = {
      id: makeId('SHIP', customer.name),
      orderId: order.id,
      customerName: customer.name,
      destination: customer.city,
      transportMode: form.transportMode || customer.deliveryPreference,
      vehicleNo: '',
      status: 'Packed',
      packedDate: form.orderDate || today,
      shippedDate: '',
      deliveredDate: '',
      note: form.note || '',
    };

    setData((currentData) => ({
      ...currentData,
      rawLots:
        form.itemType === 'raw'
          ? currentData.rawLots.map((lot) =>
              lot.id === item.id
                ? {
                    ...lot,
                    remainingKg: roundMoney(lot.remainingKg - kg),
                    movements: [
                      {
                        id: makeId('MOV', lot.variety),
                        type: 'Direct Sale',
                        kg: -kg,
                        note: `${order.id} sold to ${customer.name}`,
                        date: order.orderDate,
                      },
                      ...lot.movements,
                    ],
                  }
                : lot
            )
          : currentData.rawLots,
      blendBatches:
        form.itemType === 'blend'
          ? currentData.blendBatches.map((batch) =>
              batch.id === item.id
                ? {
                    ...batch,
                    remainingKg: roundMoney(batch.remainingKg - kg),
                  }
                : batch
            )
          : currentData.blendBatches,
      salesOrders: [order, ...currentData.salesOrders],
      shipments: [shipment, ...currentData.shipments],
      customers: currentData.customers.map((currentCustomer) =>
        currentCustomer.id === customer.id
          ? {
              ...currentCustomer,
              outstanding: roundMoney(numberValue(currentCustomer.outstanding) + revenue),
            }
          : currentCustomer
      ),
    }));

    return order;
  }

  function updateShipment(form) {
    const shipment = data.shipments.find((item) => item.id === form.shipmentId);

    if (!shipment) {
      throw new Error('Select a shipment to update.');
    }

    const nextStatus = form.status || shipment.status;

    setData((currentData) => ({
      ...currentData,
      shipments: currentData.shipments.map((item) =>
        item.id === shipment.id
          ? {
              ...item,
              transportMode: form.transportMode || item.transportMode,
              vehicleNo: form.vehicleNo || item.vehicleNo,
              status: nextStatus,
              shippedDate:
                nextStatus === 'Dispatched' && !item.shippedDate
                  ? today
                  : item.shippedDate || form.shippedDate,
              deliveredDate:
                nextStatus === 'Delivered' && !item.deliveredDate
                  ? today
                  : item.deliveredDate || form.deliveredDate,
              note: form.note || item.note,
            }
          : item
      ),
      salesOrders: currentData.salesOrders.map((order) =>
        order.id === shipment.orderId
          ? {
              ...order,
              status: nextStatus,
            }
          : order
      ),
    }));
  }

  const value = {
    data,
    metrics,
    today,
    numberValue,
    roundMoney,
    createBlendPreview,
    addSupplier,
    createPurchaseOrder,
    receivePurchaseOrder,
    approveInvoiceReceipt,
    recordSupplierPayment,
    addCustomer,
    recordCustomerPayment,
    createBlendBatch,
    createSalesOrder,
    updateShipment,
  };

  return <EnterpriseContext.Provider value={value}>{children}</EnterpriseContext.Provider>;
}

export function useEnterprise() {
  const context = useContext(EnterpriseContext);

  if (!context) {
    throw new Error('useEnterprise must be used inside EnterpriseProvider');
  }

  return context;
}
