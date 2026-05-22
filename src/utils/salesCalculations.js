export function toFiniteNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const normalizedValue = typeof value === 'string' ? value.trim().replace(/[₹,\s]/g, '') : value;
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function roundCurrency(value) {
  return Math.round((toFiniteNumber(value) + Number.EPSILON) * 100) / 100;
}

export function roundQuantity(value) {
  return Math.round((toFiniteNumber(value) + Number.EPSILON) * 100) / 100;
}

export function calculateLineSubtotal(line) {
  return roundCurrency(toFiniteNumber(line?.kg) * toFiniteNumber(line?.pricePerKg));
}

export function calculateCartTotal(lines) {
  return roundCurrency(
    (lines || []).reduce((total, line) => total + calculateLineSubtotal(line), 0)
  );
}

export function calculateSaleRevenue({ kg, pricePerKg, shippingCharge = 0 }) {
  return roundCurrency(
    toFiniteNumber(kg) * toFiniteNumber(pricePerKg) + toFiniteNumber(shippingCharge)
  );
}
