export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeIndianMobile(value) {
  const digits = digitsOnly(value);

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  return digits;
}

export function sanitizeIndianMobileInput(value) {
  const digits = digitsOnly(value);

  if (digits.startsWith('91') && digits.length > 10) {
    return digits.slice(2, 12);
  }

  if (digits.startsWith('0') && digits.length > 10) {
    return digits.slice(1, 11);
  }

  return digits.slice(0, 10);
}

export function validateOptionalIndianMobile(value, label = 'Mobile number') {
  const normalizedMobile = normalizeIndianMobile(value);

  if (!normalizedMobile) {
    return '';
  }

  return /^[6-9]\d{9}$/.test(normalizedMobile)
    ? ''
    : `${label} must be a valid 10-digit Indian mobile number.`;
}

export function sanitizeGstinInput(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 15);
}

export function validateOptionalGstin(value, label = 'GSTIN') {
  const gstin = sanitizeGstinInput(value);

  if (!gstin) {
    return '';
  }

  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)
    ? ''
    : `${label} must be a valid 15-character GSTIN.`;
}

export function sanitizePaymentTermDays(value) {
  return digitsOnly(value).slice(0, 2);
}

export function getPaymentTermDays(value) {
  const match = String(value || '').match(/\d{1,2}/);

  if (!match) {
    return '';
  }

  return String(Number(match[0]));
}

export function validatePaymentTermDays(value, label = 'Payment terms') {
  const days = getPaymentTermDays(value);
  const dayCount = Number(days);

  if (!days || dayCount < 1 || dayCount > 99) {
    return `${label} must be entered as 1 to 99 days.`;
  }

  return '';
}

export function normalizePaymentTermDays(value, fallback = '7') {
  return validatePaymentTermDays(value) ? fallback : getPaymentTermDays(value);
}

export function formatPaymentTerms(value) {
  return `${normalizePaymentTermDays(value)} days`;
}
