DROP TABLE IF EXISTS "PurchaseOrder";

ALTER TABLE "RawInventoryLot" DROP COLUMN IF EXISTS "purchaseOrderId";
