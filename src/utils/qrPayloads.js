export function buildStockQrPayload(type, item, options = {}) {
  if (type === 'raw') {
    return JSON.stringify({
      app: 'SS-360',
      module: 'inventory',
      type: 'raw-tea-stock',
      lotId: item.id,
      bagSizeKg: options.bagSizeKg,
      bagId: options.bagId || '',
      variety: item.variety,
      grade: item.grade,
      supplier: item.supplierName,
      remainingKg: item.remainingKg,
      costPerKg: item.costPerKg,
    });
  }

  return (
    item.qrPayload ||
    JSON.stringify({
      app: 'SS-360',
      module: 'inventory',
      type: 'finished-blend-batch',
      batchId: item.id,
      productName: item.productName,
      sku: item.sku,
      remainingKg: item.remainingKg,
      costPerKg: item.costPerKg,
      sellingPricePerKg: item.sellingPricePerKg,
    })
  );
}

export function readQrValue(value) {
  const trimmedValue = String(value || '').trim();

  if (!trimmedValue) {
    return {};
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return { id: trimmedValue };
  }
}

export function getBagOptionLabel(option) {
  return `${option.remainingBagCount} bag(s) x ${option.bagSizeKg} kg`;
}
