export function numberValue(value, fallback = 0) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback;
  }

  const parsedValue = Number(
    String(value)
      .trim()
      .replace(/[₹,\s]/g, '')
  );
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function presentNumber(value, fallback = 0) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback;
  }

  return numberValue(value, fallback);
}

export function roundMoney(value) {
  return Math.round((numberValue(value) + Number.EPSILON) * 100) / 100;
}
