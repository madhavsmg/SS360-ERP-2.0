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
