import { createPrismaClient, isDirectRun } from './e2e-db.mjs';
import { resetBackendE2eState } from './e2e-reset.mjs';

const seedDate = new Date('2026-05-21T00:00:00.000Z');

export async function seedBackendE2eState() {
  await resetBackendE2eState();
  const prisma = await createPrismaClient();

  if (!prisma) {
    return { skipped: true };
  }

  try {
    const supplier = await prisma.supplier.upsert({
      where: { name: 'SS360 E2E Backend Supplier' },
      update: {
        gstin: '36ABCDE1234F1Z5',
        phone: '9000011199',
        address: 'E2E backend supplier address',
        outstanding: 2400,
      },
      create: {
        id: 'SUP-E2E-BACKEND',
        name: 'SS360 E2E Backend Supplier',
        gstin: '36ABCDE1234F1Z5',
        phone: '9000011199',
        address: 'E2E backend supplier address',
        outstanding: 2400,
      },
    });

    const invoice = await prisma.invoice.upsert({
      where: { id: 'INV-E2E-BACKEND-001' },
      update: {
        status: 'APPROVED',
        approvedAt: seedDate,
        approvedJson: {
          id: 'INV-E2E-BACKEND-001',
          invoiceNumber: 'E2E-BACKEND-001',
          supplierId: supplier.id,
          supplierName: supplier.name,
          netTotal: 2400,
          status: 'Approved',
        },
      },
      create: {
        id: 'INV-E2E-BACKEND-001',
        originalFileName: 'ss360-e2e-backend-seed.pdf',
        storedFileName: 'ss360-e2e-backend-seed.pdf',
        filePath: 'E2E_SANDBOX_FILE',
        mimeType: 'application/pdf',
        size: 1,
        sourceType: 'E2E',
        status: 'APPROVED',
        rawText: 'Seeded backend E2E invoice',
        extractionJson: { mode: 'seeded' },
        reviewJson: { mode: 'seeded' },
        approvedJson: {
          id: 'INV-E2E-BACKEND-001',
          invoiceNumber: 'E2E-BACKEND-001',
          supplierId: supplier.id,
          supplierName: supplier.name,
          netTotal: 2400,
          status: 'Approved',
        },
        confidenceScore: 100,
        approvedAt: seedDate,
      },
    });

    await prisma.rawInventoryLot.upsert({
      where: { id: 'RAW-E2E-BACKEND-001' },
      update: {
        remainingKg: 20,
        costPerKg: 120,
      },
      create: {
        id: 'RAW-E2E-BACKEND-001',
        invoiceId: invoice.id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        variety: 'E2E Backend Assam',
        grade: 'BOP',
        bags: 1,
        bagWeightKg: 20,
        receivedKg: 20,
        remainingKg: 20,
        costPerKg: 120,
        goodsRatePerKg: 120,
        goodsAmount: 2400,
        acquisitionChargeShare: 0,
        landedCost: 2400,
        reorderKg: 10,
        receivedDate: seedDate,
        qualityJson: { taste: 8, color: 8, aroma: 8 },
        movementsJson: [
          {
            id: 'MOV-E2E-BACKEND-001',
            type: 'Invoice Received',
            kg: 20,
            note: 'Seeded backend E2E lot',
            date: '2026-05-21',
          },
        ],
      },
    });

    return {
      supplierId: supplier.id,
      invoiceId: invoice.id,
      rawLotId: 'RAW-E2E-BACKEND-001',
    };
  } finally {
    await prisma.$disconnect();
  }
}

if (isDirectRun(import.meta.url)) {
  seedBackendE2eState()
    .then((result) => {
      if (result.skipped) {
        return;
      }

      console.log(
        `Seeded backend E2E records: supplier ${result.supplierId}, invoice ${result.invoiceId}, raw lot ${result.rawLotId}.`
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
