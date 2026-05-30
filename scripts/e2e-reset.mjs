import { createPrismaClient, isDirectRun } from './e2e-db.mjs';

export async function resetBackendE2eState() {
  const prisma = await createPrismaClient();

  if (!prisma) {
    return { skipped: true };
  }

  try {
    const rawLots = await prisma.rawInventoryLot.deleteMany({
      where: {
        OR: [{ id: { startsWith: 'RAW-E2E-' } }, { supplierName: { startsWith: 'SS360 E2E' } }],
      },
    });
    const invoices = await prisma.invoice.deleteMany({
      where: {
        OR: [
          { id: { startsWith: 'INV-E2E-' } },
          { originalFileName: { startsWith: 'ss360-e2e' } },
          { storedFileName: { startsWith: 'ss360-e2e' } },
        ],
      },
    });
    const suppliers = await prisma.supplier.deleteMany({
      where: {
        name: { startsWith: 'SS360 E2E' },
      },
    });

    return {
      rawLots: rawLots.count,
      invoices: invoices.count,
      suppliers: suppliers.count,
    };
  } finally {
    await prisma.$disconnect();
  }
}

if (isDirectRun(import.meta.url)) {
  resetBackendE2eState()
    .then((result) => {
      if (result.skipped) {
        return;
      }

      console.log(
        `Reset backend E2E records: ${result.rawLots} raw lots, ${result.invoices} invoices, ${result.suppliers} suppliers.`
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
