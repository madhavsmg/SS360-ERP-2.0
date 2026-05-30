import assert from 'node:assert/strict';
import {
  calculateCartTotal,
  calculateLineSubtotal,
  calculateSaleRevenue,
  roundCurrency,
} from '../src/utils/salesCalculations.js';

assert.equal(calculateLineSubtotal({ kg: 10, pricePerKg: 155 }), 1550);
assert.equal(calculateLineSubtotal({ kg: '10', pricePerKg: '155' }), 1550);
assert.equal(calculateLineSubtotal({ kg: 10, pricePerKg: 155.45 }), 1554.5);
assert.equal(calculateLineSubtotal({ kg: 0.3, pricePerKg: 155 }), 46.5);
assert.equal(
  calculateCartTotal([
    { kg: 10, pricePerKg: 155 },
    { kg: 2.5, pricePerKg: 80 },
  ]),
  1750
);
assert.equal(calculateSaleRevenue({ kg: 10, pricePerKg: 155, shippingCharge: 45 }), 1595);
assert.equal(roundCurrency(1.005), 1.01);

console.log('Sales calculation checks passed.');
