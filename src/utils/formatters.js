export function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatKg(value) {
  return `${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })} kg`;
}

export function formatPercent(value) {
  return `${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 1,
  })}%`;
}
