import assert from 'node:assert/strict';

import { numberValue, roundMoney } from '../src/utils/erpNumbers.js';
import { buildStockQrPayload, getBagOptionLabel, readQrValue } from '../src/utils/qrPayloads.js';
import { calculateCartTotal, calculateSaleRevenue } from '../src/utils/salesCalculations.js';

assert.equal(numberValue('₹1,250.50'), 1250.5);
assert.equal(roundMoney(12.345), 12.35);

assert.equal(
  calculateCartTotal([
    { kg: 2, pricePerKg: 110 },
    { kg: '1.5', pricePerKg: '120' },
  ]),
  400
);
assert.equal(calculateSaleRevenue({ kg: 5, pricePerKg: 100, shippingCharge: 30 }), 530);

const rawPayload = buildStockQrPayload(
  'raw',
  {
    id: 'RAW-1',
    variety: 'Assam CTC',
    grade: 'BOP',
    supplierName: 'Supplier',
    remainingKg: 100,
    costPerKg: 150,
  },
  { bagSizeKg: 35, bagId: 'BAG-1' }
);
const parsedPayload = readQrValue(rawPayload);

assert.equal(parsedPayload.type, 'raw-tea-stock');
assert.equal(parsedPayload.lotId, 'RAW-1');
assert.equal(parsedPayload.bagSizeKg, 35);
assert.equal(readQrValue('RAW-1').id, 'RAW-1');
assert.equal(getBagOptionLabel({ remainingBagCount: 3, bagSizeKg: 35 }), '3 bag(s) x 35 kg');

console.log('Shared helper checks passed.');
