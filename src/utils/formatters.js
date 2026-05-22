import { toFiniteNumber } from './salesCalculations';

export function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(toFiniteNumber(value));
}

export function formatKg(value) {
  return `${toFiniteNumber(value).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })} kg`;
}

export function formatPercent(value) {
  return `${toFiniteNumber(value).toLocaleString('en-IN', {
    maximumFractionDigits: 1,
  })}%`;
}
